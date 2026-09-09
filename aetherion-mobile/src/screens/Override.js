import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import apiClient from '../api/client';
import { GlassCard, Screen, theme } from '../ui/AetherionUI';

export default function Override() {
  const [taskId, setTaskId] = useState('');
  const [reason, setReason] = useState('');

  const handleOverride = async () => {
    try {
      const res = await apiClient.post(`/tasks/override/${taskId}`, null, { params: { reason } });
      Alert.alert('Success', res.data.status);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Screen><View style={styles.container}><Text style={styles.eyebrow}>ADMINISTRATIVE ACTION</Text><Text style={styles.title}>Override safely.</Text><GlassCard style={styles.card}><TextInput placeholder="Task ID" placeholderTextColor="#74829e" value={taskId} onChangeText={setTaskId} style={styles.input} /><TextInput multiline placeholder="Justification for the override" placeholderTextColor="#74829e" value={reason} onChangeText={setReason} style={[styles.input, styles.reason]} /><Pressable onPress={handleOverride} style={styles.button}><Text style={styles.buttonText}>APPLY OVERRIDE</Text></Pressable></GlassCard></View></Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 30 }, eyebrow: { color: theme.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginHorizontal: 20 }, title: { color: theme.text, fontSize: 30, fontWeight: '800', margin: 20 }, card: {},
  input: { color: theme.text, borderColor: theme.line, borderWidth: 1, backgroundColor: 'rgba(2,10,23,.34)', padding: 14, marginBottom: 12, borderRadius: 14 }, reason: { minHeight: 100, textAlignVertical: 'top' }, button: { padding: 15, backgroundColor: '#d9576b', borderRadius: 14, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: .5 },
});
