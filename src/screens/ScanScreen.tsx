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
} from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
import { colors, spacing, fontSize } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package } from '../types';

function generateInternalId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `DE-${num}`;
}

export default function ScanScreen() {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [qrData, setQrData] = useState('');
  const [saving, setSaving] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanEnabledRef = useRef(false);

  // Paquetes escaneados en esta sesion de retiro
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
        Alert.alert('Error', 'Permiso de camara denegado. Habilita la camara en la configuracion del navegador.');
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
    parseQrData(data);
    setShowManualForm(true);
  }

  function parseQrData(data: string) {
    try {
      const parsed = JSON.parse(data);
      setRecipientName(parsed.recipient || parsed.nombre || parsed.destinatario || '');
      setAddress(parsed.address || parsed.direccion || '');
      setComuna(parsed.comuna || parsed.city || parsed.ciudad || '');
      setStoreOrigin(parsed.store || parsed.tienda || parsed.origin || '');
      return;
    } catch {}

    const parts = data.split(/[|;,\n]/);
    if (parts.length >= 2) {
      for (const part of parts) {
        const [key, ...valueParts] = part.split(':');
        const value = valueParts.join(':').trim();
        const keyLower = key?.trim().toLowerCase() || '';

        if (['nombre', 'destinatario', 'recipient'].includes(keyLower)) {
          setRecipientName(value);
        } else if (['direccion', 'address', 'dir'].includes(keyLower)) {
          setAddress(value);
        } else if (['comuna', 'city', 'ciudad'].includes(keyLower)) {
          setComuna(value);
        } else if (['tienda', 'store', 'origen'].includes(keyLower)) {
          setStoreOrigin(value);
        }
      }
    }
  }

  function resetForm() {
    setQrData('');
    setRecipientName('');
    setAddress('');
    setComuna('');
    setStoreOrigin('');
    setShowManualForm(false);
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
      resetForm();
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Lista de paquetes escaneados en esta sesion
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

  // Formulario de datos del paquete
  if (showManualForm) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          <Text style={styles.formTitle}>Datos del paquete</Text>

          {qrData ? (
            <View style={styles.qrPreview}>
              <Text style={styles.qrLabel}>QR escaneado:</Text>
              <Text style={styles.qrText} numberOfLines={3}>{qrData}</Text>
            </View>
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
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Pantalla principal de escaneo
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
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  submessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
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
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
  },
  saveButton: {
    backgroundColor: colors.secondary,
  },
  cancelButton: {
    backgroundColor: colors.textSecondary,
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
