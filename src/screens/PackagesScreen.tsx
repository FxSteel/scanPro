import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

export default function PackagesScreen() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<PackageStatus | 'all'>('all');

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (user?.role === 'driver') {
      query = query.or(`driver_id.eq.${user.id},scanned_by.eq.${user.id}`);
    }

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data } = await query;
    setPackages((data as Package[]) || []);
    setLoading(false);
  }, [user, filterStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchPackages();
    }, [fetchPackages])
  );

  const filtered = packages.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.internal_id?.toLowerCase().includes(s) ||
      p.address.toLowerCase().includes(s) ||
      p.comuna.toLowerCase().includes(s) ||
      p.recipient_name?.toLowerCase().includes(s) ||
      p.store_origin?.toLowerCase().includes(s)
    );
  });

  function renderPackage({ item }: { item: Package }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>{item.internal_id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{statusLabels[item.status]}</Text>
          </View>
        </View>
        <Text style={styles.address} numberOfLines={2}>{item.address}</Text>
        <Text style={styles.comuna}>{item.comuna}</Text>
        {item.recipient_name ? (
          <Text style={styles.detail}>Para: {item.recipient_name}</Text>
        ) : null}
        {item.store_origin ? (
          <Text style={styles.detail}>Tienda: {item.store_origin}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por ID, direccion, comuna..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.filters}>
        {(['all', 'retirado', 'en_bodega', 'en_ruta', 'entregado', 'reprogramado'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              filterStatus === status && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === status && styles.filterTextActive,
              ]}
            >
              {status === 'all' ? 'Todos' : statusLabels[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderPackage}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchPackages} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Cargando...' : 'No hay paquetes'}
          </Text>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchInput: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: '#fff',
    fontWeight: '600',
  },
  address: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  comuna: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
