import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { agentsAPI } from '../api/client';
import { GlassCard, Screen, theme } from '../ui/AetherionUI';

export default function Agents() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    agentsAPI.list().then((res) => setAgents(res.data.agents));
  }, []);

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
  name: { fontWeight: 'bold', fontSize: 16, color: theme.text },
  college: { color: theme.cyan, marginVertical: 4 },
});
