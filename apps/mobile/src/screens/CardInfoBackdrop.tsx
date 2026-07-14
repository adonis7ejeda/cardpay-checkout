import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { FakeCardInputDto } from "@cardpay/contracts";
import { validateFakeCard } from "@cardpay/core";
import { BackdropShell } from "../ui/BackdropShell";
import { PrimaryButton } from "../ui/PrimaryButton";
import { INSTALLMENT_OPTIONS } from "../store";

export interface CardInfoBackdropProps {
  open: boolean;
  value: FakeCardInputDto;
  installments: number;
  onChangeField: (field: keyof FakeCardInputDto, value: string) => void;
  onChangeInstallments: (value: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  today?: Date;
}

/** Screen 5 — Credit Card Info backdrop: entry + real-time validation + installments. */
export function CardInfoBackdrop({ open, value, installments, onChangeField, onChangeInstallments, onCancel, onSubmit, today }: CardInfoBackdropProps) {
  const validation = validateFakeCard(value, today);

  return (
    <BackdropShell title="Card details" open={open} onCancel={onCancel}>
      <ScrollView contentContainerStyle={styles.form}>
        {validation.brand !== "unknown" && <Text style={styles.brand}>{validation.brand}</Text>}

        <Text style={styles.label}>Cardholder name</Text>
        <TextInput
          accessibilityLabel="Cardholder name"
          value={value.cardholderName}
          onChangeText={(text) => onChangeField("cardholderName", text)}
          style={styles.input}
        />
        {validation.errors.cardholderName && <Text style={styles.error}>{validation.errors.cardholderName}</Text>}

        <Text style={styles.label}>Card number</Text>
        <TextInput
          accessibilityLabel="Card number"
          value={value.number}
          onChangeText={(text) => onChangeField("number", text)}
          keyboardType="number-pad"
          style={styles.input}
        />
        {validation.errors.number && <Text style={styles.error}>{validation.errors.number}</Text>}

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>MM</Text>
            <TextInput
              accessibilityLabel="Expiration month"
              value={value.expirationMonth}
              onChangeText={(text) => onChangeField("expirationMonth", text)}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>YY</Text>
            <TextInput
              accessibilityLabel="Expiration year"
              value={value.expirationYear}
              onChangeText={(text) => onChangeField("expirationYear", text)}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>CVC</Text>
            <TextInput
              accessibilityLabel="CVC"
              value={value.cvc}
              onChangeText={(text) => onChangeField("cvc", text)}
              keyboardType="number-pad"
              secureTextEntry
              style={styles.input}
            />
          </View>
        </View>
        {validation.errors.expirationMonth && <Text style={styles.error}>{validation.errors.expirationMonth}</Text>}
        {validation.errors.cvc && <Text style={styles.error}>{validation.errors.cvc}</Text>}

        <Text style={styles.label}>Installments</Text>
        <View style={styles.installmentsRow}>
          {INSTALLMENT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`${option} installments`}
              onPress={() => onChangeInstallments(option)}
              style={[styles.installmentChip, installments === option && styles.installmentChipSelected]}
            >
              <Text style={[styles.installmentLabel, installments === option && styles.installmentLabelSelected]}>{option}x</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="Continue" onPress={onSubmit} disabled={!validation.valid} />
      </ScrollView>
    </BackdropShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, paddingBottom: 24 },
  brand: { alignSelf: "flex-start", backgroundColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, textTransform: "capitalize", fontSize: 12 },
  label: { fontSize: 12, color: "#4b5563", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, minHeight: 44, paddingHorizontal: 12 },
  error: { color: "#b91c1c", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowItem: { flex: 1 },
  installmentsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  installmentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#e5e7eb" },
  installmentChipSelected: { backgroundColor: "#1a56db" },
  installmentLabel: { fontWeight: "600" },
  installmentLabelSelected: { color: "#ffffff" }
});
