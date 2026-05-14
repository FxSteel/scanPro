import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, PackageStatus, RouteStatus } from '../types';
import RouteDetailScreen from './RouteDetailScreen';

const statusLabels: Record<RouteStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
};

const statusColors: Record<RouteStatus, string> = {
  pending: colors.statusBodega,
  in_progress: colors.statusEnRuta,
  completed: colors.statusEntregado,
};

interface RouteWithPackages {
  id: string;
  name: string;
  driver_id: string;
  date: string;
  status: RouteStatus;
  zona?: string;
  created_at: string;
  packages: Package[];
}

export default function RoutesScreen() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<RouteWithPackages[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteWithPackages | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('routes')
      .select('*, packages(*)')
      .order('date', { ascending: false });

    if (user?.role === 'driver') {
      query = query.eq('driver_id', user.id);
    }

    const { data } = await query;
    setRoutes((data as RouteWithPackages[]) || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchRoutes();
    }, [fetchRoutes])
  );

  if (selectedRoute) {
    return (
      <RouteDetailScreen
        route={selectedRoute}
        onBack={() => {
          setSelectedRoute(null);
          fetchRoutes();
        }}
      />
    );
  }

  function renderRoute({ item }: { item: RouteWithPackages }) {
    const total = item.packages?.length || 0;
    const scanned = item.packages?.filter((p) => p.status === 'en_ruta' || p.status === 'entregado').length || 0;
    const delivered = item.packages?.filter((p) => p.status === 'entregado').length || 0;

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedRoute(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.routeName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{statusLabels[item.status]}</Text>
          </View>
        </View>
        {item.zona ? <Text style={styles.zona}>Zona: {item.zona}</Text> : null}
        <Text style={styles.detail}>Fecha: {item.date}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.statusEnRuta }]}>{scanned}</Text>
            <Text style={styles.statLabel}>Escaneados</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.statusEntregado }]}>{delivered}</Text>
            <Text style={styles.statLabel}>Entregados</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRoutes} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Cargando...' : 'No tienes rutas asignadas'}
          </Text>
        }
        contentContainerStyle={routes.length === 0 ? styles.emptyContainer : { padding: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
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
  routeName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
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
  zona: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
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
