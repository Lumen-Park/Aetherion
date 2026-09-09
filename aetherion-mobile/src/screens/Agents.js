import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { agentsAPI } from '../api/client';
import { GlassCard, Screen, theme } from '../ui/AetherionUI';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [state, setState] = useState('loading');

  const loadAgents = () => { setState('loading'); agentsAPI.list().then((res) => { setAgents(res.data.agents); setState('ready'); }).catch(() => setState('error')); };
  useEffect(loadAgents, []);
  if (state === 'loading') return <Screen><ActivityIndicator style={styles.loader} color={theme.cyan} /></Screen>;
  if (state === 'error') return <Screen><View style={styles.message}><Text style={styles.messageTitle}>Roster unavailable</Text><Text style={styles.messageCopy}>Check your connection and try again.</Text><Pressable onPress={loadAgents} style={styles.retry}><Text style={styles.retryText}>RETRY</Text></Pressable></View></Screen>;

  return (
    <Screen><FlatList contentContainerStyle={styles.list}
      data={agents}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <GlassCard style={styles.item}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.college}>{item.college}</Text>
          <Text>{item.expertise}</Text>
        </GlassCard>
      )}
    /></Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 20 }, item: { marginBottom: 12 },
  name: { fontWeight: 'bold', fontSize: 16, color: theme.text }, loader: { marginTop: 50 }, message: { margin: 20, marginTop: 40, padding: 22, borderRadius: 22, backgroundColor: 'rgba(20,34,57,.82)', borderWidth: 1, borderColor: theme.line }, messageTitle: { color: theme.text, fontSize: 19, fontWeight: '800' }, messageCopy: { color: theme.muted, marginTop: 8 }, retry: { marginTop: 18, alignSelf: 'flex-start', backgroundColor: theme.indigo, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 }, retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  college: { color: theme.cyan, marginVertical: 4 },
});
