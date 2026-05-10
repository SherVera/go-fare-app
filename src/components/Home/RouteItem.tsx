import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';
import type { RouteItemProps } from '@/interfaces';

export const RouteItem = ({
  number,
  label = 'RUTA',
  title,
  subtitle,
  status,
  type = 'bus',
  statusType = 'success',
  icon,
}: RouteItemProps) => {
  const isMetro = type === 'metro';
  const badgeColor = isMetro ? tokens.colors.primary : '#0F766E';

  const getStatusColors = () => {
    switch (statusType) {
      case 'success':
        return {
          bg: tokens.colors.statusGreenBg,
          text: tokens.colors.statusGreen,
        };
      case 'warning':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'primary':
        return { bg: '#DBEAFE', text: '#1D4ED8' };
      default:
        return { bg: '#E2E8F0', text: '#475569' };
    }
  };

  const statusColors = getStatusColors();

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={[styles.routeBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.routeNumber}>{number}</Text>
          <Text style={styles.routeLabel}>{isMetro ? 'METRO' : label}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.subtitleRow}>
            {icon && (
              <Ionicons
                name={icon}
                size={12}
                color={badgeColor}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
        <Text style={[styles.statusText, { color: statusColors.text }]}>
          {status}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  routeNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.black,
  },
  routeLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  info: {
    marginLeft: 16,
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
    color: tokens.colors.textGray,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: tokens.colors.statusGreenBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: tokens.colors.statusGreen,
    fontSize: 10,
    fontFamily: tokens.typography.fontFamily.black,
    textTransform: 'uppercase',
  },
});
