/**
 * Add (/addresses/new) or edit (/addresses/{id}) a delivery address, with the
 * exact fields the API supports. Opened from checkout (?from=checkout), a new
 * address is selected for the order straight away.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import type { Address } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { selectCheckoutAddress } from '@/checkout/checkoutStore';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAddresses, useAddressMutations } from '@/hooks/useCustomer';
import { colors, spacing } from '@/theme';
import { cleanAddress, validateAddress, type AddressValues, type FieldErrors } from '@/utils/validation';

type Field = keyof AddressValues;

function valuesFrom(address: Address | undefined, fallback: Partial<AddressValues>): AddressValues {
  return {
    label: address?.label ?? '',
    recipientName: address?.recipientName ?? fallback.recipientName ?? '',
    phone: address?.phone ?? fallback.phone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    area: address?.area ?? '',
    city: address?.city ?? '',
    postalCode: address?.postalCode ?? '',
    instructions: address?.instructions ?? '',
  };
}

function AddressForm({ address, fromCheckout }: { address?: Address; fromCheckout: boolean }) {
  const { customer } = useAuth();
  const { create, update } = useAddressMutations();
  const [values, setValues] = useState(() => valuesFrom(address, { recipientName: customer?.name, phone: customer?.phone }));
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = useRef(false);
  const saving = create.isPending || update.isPending;

  // New address: once the profile has loaded, suggest the customer's name and phone (unless already typed).
  useEffect(() => {
    if (address || !customer) return;
    setValues((v) => ({ ...v, recipientName: v.recipientName || customer.name, phone: v.phone || customer.phone }));
  }, [address, customer]);

  const field = (name: Field, label: string, extra: object = {}) => (
    <TextField
      label={label}
      value={values[name]}
      onChangeText={(text) => {
        setValues((v) => ({ ...v, [name]: text }));
        if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
      }}
      error={errors[name]}
      {...extra}
    />
  );

  const save = async () => {
    if (busy.current) return;
    const found = validateAddress(values);
    setErrors(found);
    setFormError(Object.keys(found).length > 0 ? MESSAGES.invalid : null);
    if (Object.keys(found).length > 0) return;

    busy.current = true;
    try {
      const body = { ...cleanAddress(values), ...(makeDefault ? { isDefault: true } : {}) };
      const saved = address ? await update.mutateAsync({ id: address.id, changes: body }) : await create.mutateAsync(body);
      if (fromCheckout && !address) selectCheckoutAddress(saved.id);
      router.back();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setErrors(err.fields as FieldErrors<Field>);
        setFormError(MESSAGES.invalid);
      } else {
        setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
      }
    } finally {
      busy.current = false;
    }
  };

  return (
    <FormScreen footer={<Button title={address ? 'Save address' : 'Add address'} icon="checkmark" onPress={() => void save()} loading={saving} fullWidth />}>
      {formError && <Notice tone="error">{formError}</Notice>}
      {field('label', 'Label (optional)', { placeholder: 'Home, Work…', autoCapitalize: 'words' })}
      {field('recipientName', 'Recipient name', { autoComplete: 'name', autoCapitalize: 'words' })}
      {field('phone', 'Phone number', { keyboardType: 'phone-pad', autoComplete: 'tel', helper: 'The rider calls this number, e.g. 0300 1234567' })}
      {field('line1', 'House and street', { autoComplete: 'street-address', autoCapitalize: 'words' })}
      {field('line2', 'Apartment or landmark (optional)', { autoCapitalize: 'sentences' })}
      {field('area', 'Area', { autoCapitalize: 'words', placeholder: 'e.g. Gulberg' })}
      {field('city', 'City', { autoCapitalize: 'words' })}
      {field('postalCode', 'Postal code (optional)', { keyboardType: 'number-pad', autoComplete: 'postal-code' })}
      {field('instructions', 'Delivery instructions (optional)', { multiline: true, placeholder: 'e.g. Ring the bell twice', style: styles.multiline })}
      {!address?.isDefault && (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="bodyStrong">Make this my default address</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Your first address is the default automatically.
            </AppText>
          </View>
          <Switch
            value={makeDefault}
            onValueChange={setMakeDefault}
            accessibilityLabel="Make this my default address"
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>
      )}
    </FormScreen>
  );
}

export default function AddressFormScreen() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const editing = id !== undefined;
  const addresses = useAddresses({ enabled: editing });

  if (!editing) return <AddressForm fromCheckout={from === 'checkout'} />;
  if (addresses.isPending) return <LoadingState label="Loading address…" />;
  if (addresses.isError) return <ErrorState error={addresses.error} title="Couldn't load this address" onRetry={() => addresses.refetch()} />;
  const address = addresses.data.find((a) => String(a.id) === id);
  if (!address) {
    return (
      <>
        <Stack.Screen options={{ title: 'Address' }} />
        <EmptyState icon="location-outline" title="Address not found" text="It may have been deleted." action={<Button title="Back to addresses" onPress={() => router.back()} />} />
      </>
    );
  }
  return <AddressForm key={address.id} address={address} fromCheckout={false} />;
}

const styles = StyleSheet.create({
  multiline: { minHeight: 80, paddingTop: spacing.md, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: spacing.xxs },
});
