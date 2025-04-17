import { Stack } from 'expo-router';
import FitnessTracker from './FitnessTracker';

export default function FitnessScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Fitness Tracker',
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerShadowVisible: false,
        }}
      />
      <FitnessTracker />
    </>
  );
} 