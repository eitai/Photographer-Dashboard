import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  Modal,
  Pressable,
  ActionSheetIOS,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { getClient, updateClient, deleteClient, getGalleries, createGallery, deleteGallery, resendGalleryEmail, createDeliveryGallery, updateGallery } from '@koral/api';
import type { Client, Gallery, GalleryStatus, SessionType } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input, StatusBadge } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Session type picker
// ---------------------------------------------------------------------------

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

const QUERY_KEYS = {
  client: (id: string) => ['client', id] as const,
  galleries: ['galleries'] as const,
};

const GALLERY_STATUSES: GalleryStatus[] = [
  'gallery_sent',
  'viewed',
  'selection_submitted',
  'in_editing',
  'delivered',
];

// ---------------------------------------------------------------------------
// Gallery row with actions
// ---------------------------------------------------------------------------

interface GalleryRowProps {
  item: Gallery;
  clientEmail?: string;
  clientPhone?: string;
  clientName?: string;
  hasDelivery: boolean;
  onDelete: (id: string, title: string) => void;
  onCopyLink: (gallery: Gallery) => void;
  onResendEmail: (galleryId: string) => void;
  onWhatsApp: (gallery: Gallery) => void;
  onCreateDelivery: (galleryId: string) => void;
  onChangeStatus: (galleryId: string, status: GalleryStatus) => void;
}

function GalleryRow({ item, clientEmail, clientPhone, hasDelivery, onDelete, onCopyLink, onResendEmail, onWhatsApp, onCreateDelivery, onChangeStatus }: GalleryRowProps) {
  const { t } = useLanguage();
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  function openStatusPicker() {
    if (Platform.OS === 'ios') {
      const options = [...GALLERY_STATUSES.map((s) => t(`admin.status.${s}`)), t('admin.common.cancel')];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, title: t('admin.galleries.select_status') },
        (idx) => { if (idx < GALLERY_STATUSES.length) onChangeStatus(item._id, GALLERY_STATUSES[idx]); },
      );
    } else {
      setStatusModalVisible(true);
    }
  }

  return (
    <Card style={styles.galleryCard}>
      <TouchableOpacity
        onPress={() => router.push(`/(app)/galleries/${item._id}`)}
        accessibilityRole='button'
        accessibilityLabel={item.title}
      >
        <View style={styles.galleryRowTop}>
          <Text style={styles.galleryTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.badgeRow}>
            {item.isDelivery && (
              <View style={styles.deliveryBadge}>
                <Text style={styles.deliveryBadgeText}>{t('admin.client.delivery_badge')}</Text>
              </View>
            )}
            <StatusBadge status={item.status} />
          </View>
        </View>
        <Text style={styles.imageCount}>
          {item.images.length} {t('admin.galleries.images')}
        </Text>
      </TouchableOpacity>

      {/* Create delivery gallery — shown when selection is submitted and no delivery exists yet */}
      {item.status === 'selection_submitted' && !hasDelivery && !item.isDelivery && (
        <TouchableOpacity
          style={styles.createDeliveryBtn}
          onPress={() => onCreateDelivery(item._id)}
          accessibilityRole='button'
          accessibilityLabel={t('admin.client.create_delivery')}
        >
          <Ionicons name='sparkles-outline' size={16} color={colors.primary} />
          <Text style={styles.createDeliveryText}>{t('admin.client.create_delivery')}</Text>
        </TouchableOpacity>
      )}

      {/* Action buttons */}
      <View style={styles.galleryActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onCopyLink(item)}
          accessibilityRole='button'
          accessibilityLabel={t('admin.client.copy_link')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name='link-outline' size={18} color={colors.primary} />
          <Text style={styles.actionLabel}>{t('admin.client.copy_link')}</Text>
        </TouchableOpacity>

        {!!clientEmail && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onResendEmail(item._id)}
            accessibilityRole='button'
            accessibilityLabel={t('admin.galleries.resend_email')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name='mail-outline' size={18} color={colors.primary} />
            <Text style={styles.actionLabel}>{t('admin.galleries.resend_email')}</Text>
          </TouchableOpacity>
        )}

        {!!clientPhone && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onWhatsApp(item)}
            accessibilityRole='button'
            accessibilityLabel={t('admin.galleries.whatsapp_send')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name='logo-whatsapp' size={18} color={colors.primary} />
            <Text style={styles.actionLabel}>{t('admin.galleries.whatsapp_send')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={openStatusPicker}
          accessibilityRole='button'
          accessibilityLabel={t('admin.galleries.select_status')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name='swap-vertical-outline' size={18} color={colors.primary} />
          <Text style={styles.actionLabel}>{t('admin.galleries.select_status')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnRight]}
          onPress={() => onDelete(item._id, item.title)}
          accessibilityRole='button'
          accessibilityLabel={t('admin.client.delete_gallery')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name='trash-outline' size={18} color={colors.error} />
          <Text style={[styles.actionLabel, styles.actionLabelError]}>{t('admin.client.delete_gallery')}</Text>
        </TouchableOpacity>
      </View>

      {/* Status picker modal (Android/web) */}
      <Modal visible={statusModalVisible} transparent animationType='fade' onRequestClose={() => setStatusModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModalVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('admin.galleries.select_status')}</Text>
            {GALLERY_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.modalOption, item.status === s && styles.modalOptionSelected]}
                onPress={() => { onChangeStatus(item._id, s); setStatusModalVisible(false); }}
              >
                <Text style={[styles.modalOptionText, item.status === s && styles.modalOptionTextSelected]}>{t(`admin.status.${s}`)}</Text>
                {item.status === s && <Ionicons name='checkmark' size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalOption, styles.modalCancel]} onPress={() => setStatusModalVisible(false)}>
              <Text style={[styles.modalOptionText, styles.modalCancelText]}>{t('admin.common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline new-gallery form
// ---------------------------------------------------------------------------

interface NewGalleryFormProps {
  clientId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function NewGalleryForm({ clientId, onCreated, onCancel }: NewGalleryFormProps) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createGallery({ title: title.trim(), clientId }),
    onSuccess: (newGallery) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
      onCreated();
      router.push(`/(app)/galleries/${newGallery._id}`);
    },
    onError: () => {
      Alert.alert('', t('admin.galleries.error'));
    },
  });

  function handleCreate() {
    if (!title.trim()) {
      setTitleError(t('admin.common.required'));
      return;
    }
    setTitleError('');
    createMutation.mutate();
  }

  return (
    <Card style={styles.newGalleryForm}>
      <Input label={t('admin.galleries.title_label')} value={title} onChangeText={setTitle} error={titleError} autoFocus />
      <View style={styles.newGalleryBtns}>
        <Button title={t('admin.common.cancel')} variant='ghost' onPress={onCancel} style={styles.newGalleryCancel} />
        <Button
          title={createMutation.isPending ? t('admin.common.creating') : t('admin.galleries.create')}
          onPress={handleCreate}
          loading={createMutation.isPending}
          style={styles.newGalleryCreate}
        />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline delivery gallery form
// ---------------------------------------------------------------------------

interface DeliveryGalleryFormProps {
  galleryId: string;
  clientId: string;
  defaultName: string;
  onCreated: () => void;
  onCancel: () => void;
}

function DeliveryGalleryForm({ galleryId, defaultName, onCreated, onCancel }: DeliveryGalleryFormProps) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [headerMessage, setHeaderMessage] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createDeliveryGallery(galleryId, {
        name: defaultName,
        headerMessage: headerMessage.trim() || undefined,
      }),
    onSuccess: (newGallery) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
      onCreated();
      router.push(`/(app)/galleries/${newGallery._id}`);
    },
    onError: () => Alert.alert('', t('admin.galleries.error')),
  });

  return (
    <Card style={styles.newGalleryForm}>
      <Input
        label={t('admin.client.delivery_header_ph')}
        value={headerMessage}
        onChangeText={setHeaderMessage}
        multiline
        numberOfLines={2}
        autoFocus
      />
      <View style={styles.newGalleryBtns}>
        <Button title={t('admin.common.cancel')} variant='ghost' onPress={onCancel} style={styles.newGalleryCancel} />
        <Button
          title={createMutation.isPending ? t('admin.client.creating_delivery') : t('admin.client.create_delivery')}
          onPress={() => createMutation.mutate()}
          loading={createMutation.isPending}
          style={styles.newGalleryCreate}
        />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionType, setSessionType] = useState<SessionType | undefined>(undefined);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showNewGalleryForm, setShowNewGalleryForm] = useState(false);
  const [showDeliveryFormFor, setShowDeliveryFormFor] = useState<string | null>(null);

  const {
    data: client,
    isLoading,
    isError,
    refetch,
  } = useQuery<Client>({
    queryKey: QUERY_KEYS.client(id),
    queryFn: () => getClient(id),
    enabled: !!id,
  });

  const { data: galleries = [] } = useQuery<Gallery[]>({
    queryKey: QUERY_KEYS.galleries,
    queryFn: getGalleries,
  });

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone ?? '');
      setNotes(client.notes ?? '');
      setSessionType(client.sessionType ?? undefined);
    }
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Client>) => updateClient(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.client(id) });
      qc.invalidateQueries({ queryKey: ['clients'] });
      Alert.alert('', t('admin.client.save_success'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      router.replace('/(app)/clients');
    },
  });

  const deleteGalleryMutation = useMutation({
    mutationFn: (galleryId: string) => deleteGallery(galleryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
    },
  });

  const updateGalleryStatusMutation = useMutation({
    mutationFn: ({ galleryId, status }: { galleryId: string; status: GalleryStatus }) =>
      updateGallery(galleryId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.galleries });
    },
    onError: () => Alert.alert('', t('admin.galleries.error')),
  });

  const clientGalleries = galleries.filter((g) => g.clientId === id);

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

  function handleSave() {
    if (!validate()) return;
    updateMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      sessionType: sessionType || undefined,
    });
  }

  function handleDelete() {
    Alert.alert(t('admin.client.delete_confirm'), t('admin.client.delete_body'), [
      { text: t('admin.common.cancel'), style: 'cancel' },
      {
        text: t('admin.clients.delete_btn'),
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  function handleCopyLink(gallery: Gallery) {
    const link = gallery.token ? `${API_URL}/gallery/${gallery.token}` : `${API_URL}/gallery/${gallery._id}`;

    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(link).catch(() => {});
    } else {
      Clipboard.setStringAsync(link);
    }
    Alert.alert('', t('admin.galleries.link_copied'));
  }

  function handleResendEmail(galleryId: string) {
    resendGalleryEmail(galleryId)
      .then(() => Alert.alert('', t('admin.galleries.resent')))
      .catch(() => Alert.alert('', t('admin.galleries.error')));
  }

  function handleWhatsApp(gallery: Gallery) {
    if (!client?.phone) return;
    const link = gallery.token
      ? `${API_URL}/gallery/${gallery.token}`
      : `${API_URL}/gallery/${gallery._id}`;
    const msg = t('admin.galleries.whatsapp_msg')
      .replace('{name}', client.name)
      .replace('{url}', link);
    const url = `whatsapp://send?phone=${client.phone}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('', t('admin.galleries.error')));
  }

  function handleDeleteGallery(galleryId: string, galleryTitle: string) {
    Alert.alert(t('admin.client.delete_gallery_confirm'), t('admin.client.delete_gallery_body'), [
      { text: t('admin.common.cancel'), style: 'cancel' },
      {
        text: t('admin.common.delete'),
        style: 'destructive',
        onPress: () => deleteGalleryMutation.mutate(galleryId),
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  if (isError || !client) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.client.error')}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={client.name} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>

      {/* Edit form */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{client.name}</Text>
        <View style={styles.formGap}>
          <Input label={t('admin.common.name')} value={name} onChangeText={setName} error={nameError} autoCapitalize='words' />
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
        <Button
          title={updateMutation.isPending ? t('admin.common.saving') : t('admin.client.save')}
          onPress={handleSave}
          loading={updateMutation.isPending}
          style={styles.saveBtn}
        />
      </Card>

      {/* Linked galleries */}
      <View style={styles.galleriesHeader}>
        <Text style={styles.sectionTitle}>{t('admin.client.galleries')}</Text>
        <TouchableOpacity
          onPress={() => setShowNewGalleryForm((v) => !v)}
          style={styles.newGalleryBtn}
          accessibilityRole='button'
          accessibilityLabel={t('admin.client.new_gallery')}
        >
          <Ionicons name={showNewGalleryForm ? 'close-outline' : 'add-circle-outline'} size={20} color={colors.primary} />
          <Text style={styles.newGalleryBtnText}>{showNewGalleryForm ? t('admin.common.cancel') : t('admin.client.new_gallery')}</Text>
        </TouchableOpacity>
      </View>

      {showNewGalleryForm && (
        <NewGalleryForm clientId={id} onCreated={() => setShowNewGalleryForm(false)} onCancel={() => setShowNewGalleryForm(false)} />
      )}

      {clientGalleries.length === 0 && !showNewGalleryForm ? (
        <Text style={styles.emptyText}>{t('admin.client.no_galleries')}</Text>
      ) : (
        <FlatList
          data={clientGalleries}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <>
              <GalleryRow
                item={item}
                clientEmail={client.email}
                clientPhone={client.phone}
                clientName={client.name}
                hasDelivery={clientGalleries.some((g) => g.deliveryOf === item._id)}
                onDelete={handleDeleteGallery}
                onCopyLink={handleCopyLink}
                onResendEmail={handleResendEmail}
                onWhatsApp={handleWhatsApp}
                onCreateDelivery={(galleryId) => setShowDeliveryFormFor(galleryId)}
                onChangeStatus={(galleryId, status) => updateGalleryStatusMutation.mutate({ galleryId, status })}
              />
              {showDeliveryFormFor === item._id && (
                <DeliveryGalleryForm
                  galleryId={item._id}
                  clientId={id}
                  defaultName={`${item.title} — ${t('admin.client.delivery_suffix')}`}
                  onCreated={() => setShowDeliveryFormFor(null)}
                  onCancel={() => setShowDeliveryFormFor(null)}
                />
              )}
            </>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {/* Delete client */}
      <Button
        title={deleteMutation.isPending ? t('admin.common.deleting') : t('admin.client.delete')}
        variant='ghost'
        onPress={handleDelete}
        loading={deleteMutation.isPending}
        style={styles.deleteBtn}
      />
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
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  formGap: {
    gap: spacing.md,
  },
  saveBtn: {
    marginTop: spacing.lg,
  },
  // Galleries section
  galleriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  newGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  newGalleryBtnText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  // Inline form
  newGalleryForm: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  newGalleryBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  newGalleryCancel: {
    flex: 1,
  },
  newGalleryCreate: {
    flex: 2,
  },
  // Gallery card
  galleryCard: {
    marginBottom: 0,
  },
  galleryRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  galleryTitle: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  imageCount: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  galleryActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingVertical: 2,
  },
  actionBtnRight: {
    justifyContent: 'flex-end',
  },
  actionLabel: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  actionLabelError: {
    color: colors.error,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  deleteBtn: {
    marginTop: spacing.xl,
  },
  errorText: {
    fontSize: typography.md,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: typography.md,
    color: colors.textOnPrimary,
    fontWeight: typography.semibold,
  },
  // Gallery badges
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deliveryBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deliveryBadgeText: {
    fontSize: typography.xs,
    color: '#388e3c',
    fontWeight: typography.semibold,
  },
  createDeliveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  createDeliveryText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
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
    backgroundColor: colors.surface,
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
  modalTitle: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancel: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  modalCancelText: {
    color: colors.textMuted,
  },
});
