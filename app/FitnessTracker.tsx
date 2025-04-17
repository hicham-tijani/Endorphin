import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { SafeAreaView } from 'react-native-safe-area-context';

interface StepData {
  steps: number;
  distance: number;
  calories: number;
}

const FitnessTracker = () => {
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean | null>(null);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const available = await Pedometer.isAvailableAsync();
      setIsPedometerAvailable(available);
    })();
  }, []);

  const startTracking = () => {
    setSteps(0);
    setCalories(0);
    setDistance(0);
    setIsTracking(true);

    const pedometerSubscription = Pedometer.watchStepCount(result => {
      setSteps(result.steps);
      const distanceInKm = (result.steps * 0.762) / 1000; // Average stride length
      setDistance(distanceInKm);
      setCalories(result.steps * 0.04); // 0.04 kcal per step
    });

    setSubscription(pedometerSubscription);
  };

  const stopTracking = () => {
    if (subscription) {
      subscription.remove();
    }
    setSubscription(null);
    setIsTracking(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.availabilityText}>
          Pedometer Available: {isPedometerAvailable ? 'Yes' : 'No'}
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{steps}</Text>
            <Text style={styles.statLabel}>Steps</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{calories.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
        </View>

        {!isTracking ? (
          <Button title="Start Tracking" onPress={startTracking} />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});

export default FitnessTracker;
