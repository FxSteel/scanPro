import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Html5Qrcode } from 'html5-qrcode';
import { colors, spacing, fontSize } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { Package, PackageStatus } from '../types';

const statusLabels: Record<PackageStatus, string> = {
  retirado: 'Retirado',
  en_bodega: 'En bodega',
  en_ruta: 'En ruta',
  entregado: 'Entregado',
  reprogramado: 'Reprogramado',
};

const statusColors: Record<PackageStatus, string> = {
  retirado: colors.statusRetirado,
  en_bodega: colors.statusBodega,
  en_ruta: colors.statusEnRuta,
  entregado: colors.statusEntregado,
  reprogramado: colors.statusReprogramado,
};

interface RouteDetailProps {
  route: {
    id: string;
    name: string;
    status: string;
    zona?: string;
    date: string;
    packages: Package[];
  };
  onBack: () => void;
}

export default function RouteDetailScreen({ route, onBack }: RouteDetailProps) {
  const [packages, setPackages] = useState<Package[]>(route.packages || []);
  const [scanning, setScanning] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanEnabledRef = useRef(false);

  const scannedCount = packages.filter((p) => p.status === 'en_ruta' || p.status === 'entregado').length;
  const totalCount = packages.length;
  const canStartRoute = scannedCount > 0;

  async function startScanner() {
    try {
      const scanner = new Html5Qrcode('qr-reader-route');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!scanEnabledRef.current) return;
          scanEnabledRef.current = false;
          setScanEnabled(false);
          handlePackageScan(decodedText);
        },
        () => {}
      );

      setScanning(true);
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo iniciar la camara: ' + (err?.message || err));
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

  async function handlePackageScan(qrData: string) {
    // Find package in this route that matches the QR data
    const pkg = packages.find(
      (p) => p.qr_data === qrData || p.internal_id === qrData
    );

    if (!pkg) {
      Alert.alert('No encontrado', 'Este paquete no pertenece a esta ruta.');
      return;
    }

    if (pkg.status === 'en_ruta') {
      Alert.alert('Ya escaneado', `El paquete ${pkg.internal_id} ya fue escaneado.`);
      return;
    }

    if (pkg.status === 'entregado') {
      Alert.alert('Ya entregado', `El paquete ${pkg.internal_id} ya fue entregado.`);
      return;
    }

    // Update status to en_ruta
    const { error } = await supabase
      .from('packages')
      .update({ status: 'en_ruta' })
      .eq('id', pkg.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setPackages((prev) =>
      prev.map((p) => (p.id === pkg.id ? { ...p, status: 'en_ruta' as PackageStatus } : p))
    );

    Alert.alert('Escaneado', `${pkg.internal_id} - Listo para despacho`);
  }

  async function handleStartRoute() {
    const pending = totalCount - scannedCount;
    const message = pending > 0
      ? `Tienes ${scannedCount}/${totalCount} paquetes escaneados. ${pending} paquetes no fueron escaneados. ¿Iniciar ruta de todas formas?`
      : `Todos los paquetes escaneados (${totalCount}). ¿Iniciar ruta?`;

    Alert.alert('Iniciar ruta', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar',
        onPress: async () => {
          await supabase
            .from('routes')
            .update({ status: 'in_progress' })
            .eq('id', route.id);
          stopScanner();
          onBack();
        },
      },
    ]);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  function renderPackage({ item }: { item: Package }) {
    const isScanned = item.status === 'en_ruta' || item.status === 'entregado';

    return (
      <View style={[styles.packageCard, isScanned && styles.packageScanned]}>
        <View style={styles.packageHeader}>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>{item.internal_id}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusDotText}>{statusLabels[item.status]}</Text>
          </View>
        </View>
        <Text style={styles.packageAddress} numberOfLines={2}>{item.address}</Text>
        <Text style={styles.packageComuna}>{item.comuna}</Text>
        {item.recipient_name ? (
          <Text style={styles.packageDetail}>Para: {item.recipient_name}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stopScanner(); onBack(); }}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.routeName}>{route.name}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Escaneados: {scannedCount} / {totalCount}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: totalCount > 0 ? `${(scannedCount / totalCount) * 100}%` : '0%' },
            ]}
          />
        </View>
      </View>

      {/* Scanner */}
      <View style={styles.scannerSection}>
        <div id="qr-reader-route" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }} />

        {!scanning ? (
          <TouchableOpacity style={styles.openCameraBtn} onPress={startScanner}>
            <Text style={styles.buttonText}>Abrir camara para escanear paquetes</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.scanActions}>
            <TouchableOpacity
              style={[styles.scanButton, scanEnabled && styles.scanButtonActive]}
              onPress={triggerScan}
              disabled={scanEnabled}
            >
              <Text style={styles.buttonText}>
                {scanEnabled ? 'Buscando QR...' : 'Escanear paquete'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeCameraBtn} onPress={stopScanner}>
              <Text style={styles.buttonText}>Cerrar camara</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Package list */}
      <FlatList
        data={packages}
        keyExtractor={(item) => item.id}
        renderItem={renderPackage}
        style={styles.list}
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          <Text style={styles.listTitle}>Paquetes de la ruta</Text>
        }
      />

      {/* Start route button */}
      {canStartRoute && route.status === 'pending' && (
        <TouchableOpacity style={styles.startRouteBtn} onPress={handleStartRoute}>
          <Text style={styles.startRouteText}>
            Iniciar ruta ({scannedCount}/{totalCount} escaneados)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  routeName: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  progressBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressInfo: {
    marginBottom: spacing.xs,
  },
  progressText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.statusEnRuta,
    borderRadius: 4,
  },
  scannerSection: {
    padding: spacing.md,
    alignItems: 'center',
  },
  openCameraBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  scanActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  scanButtonActive: {
    opacity: 0.6,
  },
  closeCameraBtn: {
    backgroundColor: colors.textSecondary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  packageCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageScanned: {
    borderColor: colors.statusEnRuta,
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  idBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: 'monospace',
  },
  statusDot: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDotText: {
    fontSize: fontSize.sm,
    color: '#fff',
    fontWeight: '600',
  },
  packageAddress: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  packageComuna: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  packageDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  startRouteBtn: {
    backgroundColor: colors.secondary,
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  startRouteText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
});
