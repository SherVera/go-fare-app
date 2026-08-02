import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type Bank, VENEZUELAN_BANKS } from '@/constants/banks';
import { tokens } from '@/theme/tokens';

interface BankSelectModalProps {
  visible: boolean;
  selectedBankCode?: string;
  selectedBankName?: string;
  onSelectBank: (bank: Bank) => void;
  onClose: () => void;
}

export function BankSelectModal({
  visible,
  selectedBankCode,
  selectedBankName,
  onSelectBank,
  onClose,
}: BankSelectModalProps) {
  const [search, setSearch] = useState('');

  const filteredBanks = VENEZUELAN_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.includes(search) ||
      b.shortName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Seleccionar Banco Emisor</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color="#475569" />
          </Pressable>
        </View>

        {/* Buscador */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar banco por nombre o código..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        {/* Lista de Bancos */}
        <FlatList
          data={filteredBanks}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected =
              selectedBankCode === item.code ||
              selectedBankName === item.name ||
              selectedBankName === item.shortName;

            return (
              <Pressable
                style={[styles.bankItem, isSelected && styles.bankItemSelected]}
                onPress={() => {
                  onSelectBank(item);
                  onClose();
                }}
              >
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>
                <View style={styles.bankTextContainer}>
                  <Text style={styles.bankName}>{item.name}</Text>
                  <Text style={styles.shortName}>{item.shortName}</Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={tokens.colors.primary}
                  />
                )}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    marginLeft: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  bankItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  codeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  codeText: {
    color: '#0284C7',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
  },
  bankTextContainer: {
    flex: 1,
  },
  bankName: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  shortName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
