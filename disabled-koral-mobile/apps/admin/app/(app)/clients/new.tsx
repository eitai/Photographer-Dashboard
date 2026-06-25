import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, Modal, Pressable, ActionSheetIOS } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@koral/api';
import type { Client, SessionType } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const SESSION_TYPES: SessionType[] = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

interface SessionPickerProps {
  value: SessionType | undefined;
  onChange: (v: SessionType | undefined) => void;
}

function SessionTypePicker({ value, onChange }: SessionPickerProps) {
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const labelFor = (s: SessionType | undefined) => (s ? t(`admin.session.${s}`) : t('admin.session.none'));

  function open() {
    if (Platform.OS === 'ios') {
      const options = [t('admin.session.none'), ...SESSION_TYPES.map((s) => t(`admin.session.${s}`)), t('admin.common.cancel')];
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1 }, (idx) => {
        if (idx === 0) onChange(undefined);
        else if (idx < SESSION_TYPES.length + 1) onChange(SESSION_TYPES[idx - 1]);
      });
    } else {
      setModalVisible(true);
    }
  }

  return (
    <>
      <View>
        <Text style={styles.pickerLabel}>{t('admin.common.session_type')}</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={open}
          accessibilityRole='button'
          accessibilityLabel={t('admin.common.session_type')}
        >
          <Text style={[styles.pickerBtnText, !value && styles.pickerPlaceholder]}>{labelFor(value)}</Text>
          <Ionicons name='chevron-down' size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Android/Web modal */}
      <Modal visible={modalVisible} transparent animationType='fade' onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalSheet}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                onChange(undefined);
                setModalVisible(false);
              }}
            >
              <Text style={styles.modalOptionText}>{t('admin.session.none')}</Text>
            </TouchableOpacity>
            {SESSION_TYPES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.modalOption, value === s && styles.modalOptionSelected]}
                onPress={() => {
                  onChange(s);
                  setModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, value === s && styles.modalOptionTextSelected]}>{t(`admin.session.${s}`)}</Text>
                {value === s && <Ionicons name='checkmark' size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalOption, styles.modalCancel]} onPress={() => setModalVisible(false)}>
              <Text style={[styles.modalOptionText, styles.modalCancelText]}>{t('admin.common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NewClientScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionType, setSessionType] = useState<SessionType | undefined>(undefined);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: Partial<Client>) => createClient(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      router.replace('/(app)/clients');
    },
    onError: () => {
      Alert.alert('', t('admin.clients.error'));
    },
  });

  function validate(): boolean {
    let valid = true;
    setNameError('');
    setEmailError('');
    if (!name.trim()) {
      setNameError(t('admin.common.required'));
      valid = false;
    }
    if (!email.trim()) {
      setEmailError(t('admin.common.required'));
      valid = false;
    }
    return valid;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      sessionType: sessionType || undefined,
    });
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.clients.create')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
      <Card style={styles.card}>
        <View style={styles.formGap}>
          <Input
            label={t('admin.common.name')}
            value={name}
            onChangeText={setName}
            error={nameError}
            autoCapitalize='words'
            autoFocus
          />
          <Input
            label={t('admin.common.email')}
            value={email}
            onChangeText={setEmail}
            error={emailError}
            keyboardType='email-address'
            autoCapitalize='none'
          />
          <Input label={t('admin.common.phone')} value={phone} onChangeText={setPhone} keyboardType='phone-pad' />
          <SessionTypePicker value={sessionType} onChange={setSessionType} />
          <Input label={t('admin.common.notes')} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        </View>

        {createMutation.isError && <Text style={styles.serverError}>{t('admin.clients.error')}</Text>}

        <Button
          title={createMutation.isPending ? t('admin.common.creating') : t('admin.clients.create')}
          onPress={handleSubmit}
          loading={createMutation.isPending}
          style={styles.submitBtn}
        />
      </Card>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  backText: {
    fontSize: typography.md,
    color: colors.text,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  formGap: {
    gap: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  serverError: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Session type picker
  pickerLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface ?? colors.background,
  },
  pickerBtnText: {
    fontSize: typography.md,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: '#fdf0ef',
  },
  modalOptionText: {
    fontSize: typography.md,
    color: colors.text,
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  modalCancel: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  modalCancelText: {
    color: colors.textMuted,
  },
});
