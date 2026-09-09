import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { councilAPI } from '../api/client';
import { GlassCard, Screen, theme } from '../ui/AetherionUI';

export default function Council() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    councilAPI.stats().then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Screen><Text style={styles.loading}>Loading council pulse…</Text></Screen>;

  return (
    <Screen><View style={styles.container}><Text style={styles.eyebrow}>REVIEW INTELLIGENCE</Text><Text style={styles.title}>Council pulse</Text><GlassCard><Text style={styles.metric}>{stats.total}</Text><Text style={styles.label}>TOTAL VERDICTS</Text><View style={styles.rule}/><Text style={styles.detail}>Approval rate  <Text style={styles.value}>{(stats.approval_rate * 100).toFixed(1)}%</Text></Text><Text style={styles.detail}>Average score  <Text style={styles.value}>{stats.avg_score?.toFixed(2)}</Text></Text></GlassCard></View></Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 30 }, loading: { color: theme.muted, padding: 30 }, eyebrow: { color: theme.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginHorizontal: 20 }, title: { color: theme.text, fontSize: 30, fontWeight: '800', marginHorizontal: 20, marginVertical: 10 }, metric: { color: theme.text, fontSize: 48, fontWeight: '800' }, label: { color: theme.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 5 }, rule: { height: 1, backgroundColor: theme.line, marginVertical: 18 }, detail: { color: theme.muted, marginTop: 10 }, value: { color: theme.text, fontWeight: '800' },
});
