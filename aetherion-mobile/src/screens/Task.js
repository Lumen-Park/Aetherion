import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { tasksAPI } from '../api/client';
import { GlassCard, Screen, theme } from '../ui/AetherionUI';

export default function Task({ route }) {
  const { taskId, mode } = route.params || {};
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await tasksAPI.getStatus(taskId);
        setStatus(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  return (
    <Screen><ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>EXECUTION / LIVE</Text><Text style={styles.title}>Task pulse</Text><GlassCard>
      <Text style={styles.id}>Task: {taskId || mode || 'N/A'}</Text>
      {status ? (
        <>
          <Text>Status: {status.status}</Text>
          {status.council_verdict && (
            <Text style={styles.verdict}>
              Council: {status.council_verdict.verdict} (Score: {status.council_verdict.score})
            </Text>
          )}
          {status.result && <Text style={styles.result}>{status.result}</Text>}
        </>
      ) : (
        <Text>Loading...</Text>
      )}</GlassCard>
    </ScrollView></Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 28 }, eyebrow: { color: theme.cyan, fontWeight: '800', fontSize: 11, letterSpacing: 2, marginHorizontal: 20 }, title: { color: theme.text, fontSize: 30, fontWeight: '800', margin: 20 }, id: { color: theme.muted, marginBottom: 16 },
  verdict: { fontSize: 16, marginVertical: 5, color: theme.cyan }, result: { backgroundColor: 'rgba(2,10,23,.4)', color: theme.text, padding: 12, marginTop: 14, borderRadius: 12 },
});
