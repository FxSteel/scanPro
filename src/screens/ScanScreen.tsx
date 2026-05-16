import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { colors, spacing, fontSize } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package } from '../types';

// Comunas de la RM para detectar en OCR
const COMUNAS_RM = [
  'cerrillos','cerro navia','conchali','el bosque','estacion central',
  'huechuraba','independencia','la cisterna','la florida','la granja',
  'la pintana','la reina','las condes','lo barnechea','lo espejo',
  'lo prado','macul','maipu','nunoa','pedro aguirre cerda',
  'penalolen','providencia','pudahuel','quilicura','quinta normal',
  'recoleta','renca','san bernardo','san joaquin','san miguel',
  'san ramon','santiago','vitacura','puente alto','colina','padre hurtado',
];

function generateInternalId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `DE-${num}`;
}

function parseOcrText(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let address = '';
  let comuna = '';
  let recipientName = '';
  const textLower = text.toLowerCase();

  // Buscar comuna
  for (const c of COMUNAS_RM) {
    if (textLower.includes(c)) {
      comuna = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Buscar direccion (linea que contiene "Direccion:" o numeros de calle)
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (lineLower.startsWith('direccion:') || lineLower.startsWith('dirección:')) {
      address = line.replace(/^[Dd]irecci[oó]n:\s*/i, '').trim();
      break;
    }
  }

  // Si no encontro con prefijo, buscar patron de direccion (texto + numero)
  if (!address) {
    for (const line of lines) {
      if (/\d{2,5}/.test(line) && !/envio|pack|id|sender/i.test(line)) {
        address = line;
        break;
      }
    }
  }

  // Buscar destinatario
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (lineLower.startsWith('destinatario:')) {
      recipientName = line.replace(/^[Dd]estinatario:\s*/i, '').trim();
      // Limpiar codigos que vienen despues del nombre
      recipientName = recipientName.replace(/\(.*\)/, '').trim();
      break;
    }
  }

  return { address, comuna, recipientName };
}

export default function ScanScreen() {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [step, setStep] = useState<'scan' | 'photo' | 'review'>('scan');
  const [qrData, setQrData] = useState('');
  const [mlShipmentId, setMlShipmentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [labelPhoto, setLabelPhoto] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanEnabledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Paquetes escaneados en esta sesion
  const [scannedPackages, setScannedPackages] = useState<Package[]>([]);
  const [showScannedList, setShowScannedList] = useState(false);

  // Form fields
  const [recipientName, setRecipientName] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [storeOrigin, setStoreOrigin] = useState('');

  useEffect(() => {
    async function checkPermission() {
      try {
        const result = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = result.some((d) => d.kind === 'videoinput');
        if (!hasCamera) {
          setPermissionGranted(false);
          return;
        }
        const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permStatus.state === 'granted') {
          setPermissionGranted(true);
        } else if (permStatus.state === 'denied') {
          setPermissionGranted(false);
        } else {
          setPermissionGranted(null);
        }
      } catch {
        setPermissionGranted(null);
      }
    }
    checkPermission();
  }, []);

  async function startScanner() {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!scanEnabledRef.current) return;
          scanEnabledRef.current = false;
          setScanEnabled(false);
          handleQrResult(decodedText);
        },
        () => {}
      );

      setScanning(true);
      setPermissionGranted(true);
    } catch (err: any) {
      if (err?.toString().includes('Permission')) {
        setPermissionGranted(false);
        Alert.alert('Error', 'Permiso de camara denegado.');
      } else {
        Alert.alert('Error', 'No se pudo iniciar la camara: ' + (err?.message || err));
      }
    }
  }

  function triggerScan() {
    scanEnabledRef.current = true;
    setScanEnabled(true);
  }

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {}
    setScanning(false);
    setScanEnabled(false);
    scanEnabledRef.current = false;
  }

  function handleQrResult(data: string) {
    setQrData(data);

    // Intentar extraer shipment ID de ML
    try {
      const parsed = JSON.parse(data);
      if (parsed.id) {
        setMlShipmentId(parsed.id);
        setStoreOrigin('MercadoLibre');
      }
    } catch {
      setMlShipmentId('');
    }

    stopScanner();
    setStep('photo');
  }

  async function handlePhotoCapture(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setLabelPhoto(imageData);
      setOcrProcessing(true);

      try {
        const result = await Tesseract.recognize(imageData, 'spa');
        const parsed = parseOcrText(result.data.text);

        if (parsed.address) setAddress(parsed.address);
        if (parsed.comuna) setComuna(parsed.comuna);
        if (parsed.recipientName) setRecipientName(parsed.recipientName);

        setStep('review');
      } catch (err: any) {
        Alert.alert('Error OCR', 'No se pudo leer la etiqueta. Intenta con otra foto.');
      } finally {
        setOcrProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function resetAll() {
    setQrData('');
    setMlShipmentId('');
    setRecipientName('');
    setAddress('');
    setComuna('');
    setStoreOrigin('');
    setLabelPhoto(null);
    setStep('scan');
  }

  async function handleSave() {
    if (!address || !comuna) {
      Alert.alert('Error', 'Direccion y comuna son obligatorios');
      return;
    }

    const internalId = generateInternalId();

    setSaving(true);
    const { data, error } = await supabase.from('packages').insert({
      internal_id: internalId,
      qr_data: qrData || 'manual',
      recipient_name: recipientName,
      address,
      comuna: comuna.toLowerCase().trim(),
      store_origin: storeOrigin,
      status: 'retirado',
      scanned_by: user?.id,
    }).select().single();
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Paquete registrado', `ID: ${internalId}`);
      if (data) {
        setScannedPackages((prev) => [data as Package, ...prev]);
      }
      resetAll();
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Hidden file input for photo capture
  const fileInput = (
    <input
      ref={(el) => { fileInputRef.current = el; }}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handlePhotoCapture}
      style={{ display: 'none' }}
    />
  );

  // Lista de escaneados
  if (showScannedList) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.formTitle}>Paquetes escaneados ({scannedPackages.length})</Text>
          <TouchableOpacity onPress={() => setShowScannedList(false)}>
            <Text style={styles.linkText}>Volver</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={scannedPackages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.scannedCard}>
              <View style={styles.idBadge}>
                <Text style={styles.idText}>{item.internal_id}</Text>
              </View>
              <Text style={styles.scannedAddress}>{item.address}</Text>
              <Text style={styles.scannedComuna}>{item.comuna}</Text>
              {item.recipient_name ? (
                <Text style={styles.scannedDetail}>Para: {item.recipient_name}</Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No has escaneado paquetes aun</Text>
          }
          contentContainerStyle={scannedPackages.length === 0 ? styles.emptyContainer : { padding: spacing.md }}
        />
      </View>
    );
  }

  // PASO 3: Revisar datos extraidos por OCR
  if (step === 'review') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          <Text style={styles.formTitle}>Confirma los datos</Text>
          <Text style={styles.stepLabel}>Revisa y corrige si es necesario</Text>

          {mlShipmentId ? (
            <View style={styles.qrPreview}>
              <Text style={styles.qrLabel}>ID Envio ML:</Text>
              <Text style={styles.qrText}>{mlShipmentId}</Text>
            </View>
          ) : null}

          {labelPhoto ? (
            <Image
              source={{ uri: labelPhoto }}
              style={styles.photoPreview}
              resizeMode="contain"
            />
          ) : null}

          <Text style={styles.label}>Destinatario</Text>
          <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Nombre del destinatario"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Direccion *</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Direccion de entrega"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Comuna *</Text>
          <TextInput
            style={styles.input}
            value={comuna}
            onChangeText={setComuna}
            placeholder="Comuna"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Tienda origen</Text>
          <TextInput
            style={styles.input}
            value={storeOrigin}
            onChangeText={setStoreOrigin}
            placeholder="Ej: MercadoLibre, Falabella, Ripley"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? 'Guardando...' : 'Registrar retiro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.retakeButton]}
              onPress={() => {
                setLabelPhoto(null);
                setStep('photo');
              }}
            >
              <Text style={styles.buttonText}>Tomar otra foto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetAll}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PASO 2: Tomar foto de la etiqueta
  if (step === 'photo') {
    return (
      <View style={styles.container}>
        {fileInput}
        <View style={styles.centered}>
          {ocrProcessing ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.message}>Leyendo etiqueta...</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Foto de la etiqueta</Text>
              <Text style={styles.message}>
                Toma una foto clara de la etiqueta del paquete para extraer la direccion
              </Text>

              {mlShipmentId ? (
                <View style={styles.qrPreview}>
                  <Text style={styles.qrLabel}>ID Envio ML:</Text>
                  <Text style={styles.qrText}>{mlShipmentId}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.button, styles.photoButton]}
                onPress={() => fileInputRef.current?.click()}
              >
                <Text style={styles.buttonText}>Tomar foto de etiqueta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.skipButton]}
                onPress={() => setStep('review')}
              >
                <Text style={styles.buttonText}>Saltar (ingresar manual)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={resetAll}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // PASO 1: Escanear QR
  return (
    <View style={styles.container}>
      <View style={styles.scanContainer}>
        <div id="qr-reader" style={{ width: '100%', maxWidth: 500, margin: '0 auto' }} />

        {!scanning && (
          <View style={styles.centered}>
            {permissionGranted === false ? (
              <>
                <Text style={styles.message}>Camara no disponible o permiso denegado.</Text>
                <Text style={styles.submessage}>Revisa los permisos de camara en tu navegador.</Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Retiro de paquetes</Text>
                <Text style={styles.message}>Escanea el QR de cada paquete retirado</Text>
                <TouchableOpacity style={styles.button} onPress={startScanner}>
                  <Text style={styles.buttonText}>Abrir camara</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {scanning && (
          <View style={styles.scanActions}>
            <TouchableOpacity
              style={[styles.button, styles.scanButton, scanEnabled && styles.scanButtonActive]}
              onPress={triggerScan}
              disabled={scanEnabled}
            >
              <Text style={styles.buttonText}>
                {scanEnabled ? 'Buscando QR...' : 'Escanear'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopScanner}
            >
              <Text style={styles.buttonText}>Cerrar camara</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {scannedPackages.length > 0 && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.button, styles.listButton]}
            onPress={() => setShowScannedList(true)}
          >
            <Text style={styles.buttonText}>
              Ver escaneados ({scannedPackages.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  centered: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  message: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  submessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: spacing.lg,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  qrPreview: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  qrText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontFamily: 'monospace',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: spacing.md,
    backgroundColor: colors.border,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  formButtons: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  saveButton: {
    backgroundColor: colors.secondary,
  },
  cancelButton: {
    backgroundColor: colors.textSecondary,
  },
  photoButton: {
    backgroundColor: colors.primary,
  },
  skipButton: {
    backgroundColor: colors.statusBodega,
  },
  retakeButton: {
    backgroundColor: colors.statusEnRuta,
  },
  scanActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    width: '80%',
  },
  scanButtonActive: {
    opacity: 0.6,
  },
  stopButton: {
    backgroundColor: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    width: '80%',
  },
  bottomActions: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listButton: {
    backgroundColor: colors.statusRetirado,
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  scannedCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idBadge: {
    backgroundColor: colors.statusRetirado,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  idText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  scannedAddress: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  scannedComuna: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '500',
  },
  scannedDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});
