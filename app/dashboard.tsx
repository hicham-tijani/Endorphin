import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView , Dimensions, Button, Image, RefreshControl} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = '@fitness_stats';
const ACTIVITIES_KEY = '@fitness_activities';
const screenWidth = Dimensions.get('window').width;


interface Activity {
  date: string;
  duration: number;
  steps: number;
  distance: number;
  calories: number;
  endLocation: {
    latitude: number;
    longitude: number;
  } | null;
}


const CLIENT_ID = "a8cc75b6d0594b448e65e5b6d37713f6";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const RESPONSE_TYPE = "token";
const SCOPES = "user-read-playback-state user-modify-playback-state streaming";

// Automatically switch redirect URI between Expo Go and Standalone app
const REDIRECT_URI = __DEV__ 
  ? "exp://192.168.1.53:8081" 
  : "Endorphin://auth";


export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [track, setTrack] = useState<any>(null);



  const saveSpotifyData = async (accessToken: string, track: any) => {
    try {
      await AsyncStorage.setItem('@spotify_token', accessToken);
      await AsyncStorage.setItem('@current_track', JSON.stringify(track));
    } catch (error) {
      console.error("Error saving Spotify data:", error);
    }
  };

  const loadSpotifyData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('@spotify_token');
      const storedTrack = await AsyncStorage.getItem('@current_track');
      
      if (storedToken) {
        setToken(storedToken);
      }
  
      if (storedTrack) {
        setTrack(JSON.parse(storedTrack));
      }
    } catch (error) {
      console.error("Error loading Spotify data:", error);
    }
  };
  

  const onRefresh = () => {
    setIsRefreshing(true);
    setIsRefreshing(false);
};
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: [SCOPES],
      redirectUri: REDIRECT_URI,
      responseType: RESPONSE_TYPE,
    },
    { authorizationEndpoint: AUTH_ENDPOINT }
  );

  const handleLogin = async () => {
    const result = await promptAsync();
    if (result.type === "success" && result.params.access_token) {
      const accessToken = result.params.access_token;
      setToken(accessToken);
      await saveSpotifyData(accessToken, track);
    }
  };
  
  
  const fetchCurrentTrack = async (accessToken: string) => {
    if (!accessToken) return;
  
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
  
      console.log("Spotify API response status:", res.status);
  
      if (res.status === 200) {
        const data = await res.json();
        console.log("Brano attuale:", data);
        setTrack(data.item);
        await saveSpotifyData(accessToken, data.item);
      } else {
        setTrack(null);
      }
    } catch (error) {
      console.error("Errore nel recupero della traccia:", error);
    }
  };
  
  useEffect(() => {
    loadSpotifyData(); // Load the stored token and track when the app starts
    
    if (token) {
      fetchCurrentTrack(token); // Fetch current track if a token exists
      const interval = setInterval(() => fetchCurrentTrack(token), 5000);
      return () => clearInterval(interval);
    }
  }, [token]);



  const [recentStats, setRecentStats] = useState({
    steps: 0,
    distance: 0,
    calories: 0,
    lastActivity: null as Activity | null,
    lastUpdated: null as Date | null,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [averageStats, setAverageStats] = useState({ day: {}, week: {}, month: {} });
  
  
  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      const [statsJson, activitiesJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(ACTIVITIES_KEY),
      ]);

      if (statsJson) {
        const stats = JSON.parse(statsJson);
        setRecentStats({
          ...stats,
          lastUpdated: new Date(),
        });
      }

      if (activitiesJson) {
        const activitiesData = JSON.parse(activitiesJson);
        const last7Activities = activitiesData.slice(0, 5);
        setActivities(last7Activities);
        calculateAverages(last7Activities);
      }
    } catch (error) {
      console.log('Error loading stats:', error);
    }
  };

  const calculateAverages = (activities: Activity[]) => {
    const day = { steps: 0, duration: 0, distance: 0, calories: 0 }; 
    const week = { steps: 0, duration: 0, distance: 0, calories: 0 }; 
    const month = { steps: 0, duration: 0, distance: 0, calories: 0 }; 
  
    const now = new Date();
    activities.forEach((activity) => {
      const activityDate = new Date(activity.date);
      const diffInDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 3600 * 24));
  
      if (diffInDays <= 1) {
        day.steps += activity.steps;
        day.duration += activity.duration;
        day.distance += activity.distance;
        day.calories += activity.calories; 
      }
      if (diffInDays <= 7) {
        week.steps += activity.steps;
        week.duration += activity.duration;
        week.distance += activity.distance;
        week.calories += activity.calories; 
      }
      if (diffInDays <= 30) {
        month.steps += activity.steps;
        month.duration += activity.duration;
        month.distance += activity.distance;
        month.calories += activity.calories; 
      }
    });
  
    setAverageStats({
      day: {
        steps: day.steps / 1,
        duration: day.duration / 1,
        distance: day.distance / 1,
        calories: day.calories / 1, 
      },
      week: {
        steps: week.steps / 7,
        duration: week.duration / 7,
        distance: week.distance / 7,
        calories: week.calories / 7, 
      },
      month: {
        steps: month.steps / 30,
        duration: month.duration / 30,
        distance: month.distance / 30,
        calories: month.calories / 30, 
      },
    });
  };
  

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const StatsChart = () => {
    const chartData = {
      labels: ['Day', 'Week', 'Month'], // Labels for the time frames
      datasets: [
        {
          data: [
            averageStats.day.steps  || 0,
            averageStats.week.steps || 0,
            averageStats.month.steps|| 0,
          ],
          color: (opacity = 1) => `rgba(51, 60, 219, ${opacity})`, // Blue for steps
          strokeWidth: 3,
          label: 'Steps',
          
        },
        {
          data: [
            averageStats.day.distance || 0,
            averageStats.week.distance || 0,
            averageStats.month.distance || 0,
          ], // Green for distance
          color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`, // Green for distance
          strokeWidth: 3,
          label: 'Distance (KM)',
        },
        {
          data: [
            averageStats.day.calories+400 || 0,
            averageStats.week.calories+800 || 0,
            averageStats.month.calories+1050 || 0,
          ], // Red for calories
          color: (opacity = 1) => `rgba(51, 232, 52, ${opacity})`, // Red for calories
          strokeWidth: 3,
          label: 'Calories Burned',
        },
      ],
    };

    return (
      <View style={styles.chartWrapper}>
      <LineChart
        data={chartData}
        width={screenWidth - 40}
        height={320}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          backgroundColor: '#fff',
          backgroundGradientFrom: '#ffff',
          backgroundGradientTo: '#ffff',
          color: (opacity = 1) => `rgba(51, 60, 219, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          decimalPlaces: 2,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '6',
            strokeWidth: '2',
            stroke: '#fff',
          },
          propsForLabels: {
            fontSize: 13,
            fontWeight: '500',
          },
          propsForVerticalLabels: {
            fontSize: 13,
            fontWeight: 'bold',
          },
          propsForHorizontalLabels: {
            fontSize: 10,
          },
        }}
        bezier
        fromZero
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
        decorator={() => null}
      />
      
      {/* Custom Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#344adb' }]} />
          <Text style={styles.legendText}>Steps</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4bc0c0' }]} />
          <Text style={styles.legendText}>Distance (KM)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#33e834' }]} />
          <Text style={styles.legendText}>Calories</Text>
        </View>
      </View>
    </View>
  );
};


  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }>
        <Text style={styles.title}> My Dashboard</Text>
        <BlurView intensity={80} style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Ionicons name="footsteps" size={24} color="#344adb" />
              <Text style={styles.statValue}>{recentStats.steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>
            
            <View style={styles.stat}>
              <Ionicons name="flame" size={24} color="#33e834" />
              <Text style={styles.statValue}>{recentStats.calories.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            
            <View style={styles.stat}>
              <Ionicons name="map-outline" size={24} color="#233ce6" />
              <Text style={styles.statValue}>{recentStats.distance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>KM</Text>
            </View>
          </View>

        </BlurView>

        <Link href="/start" asChild>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>Start Activity</Text>
            <Ionicons name="flash" size={24} color="#fff" />
          </TouchableOpacity>
        </Link>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Daily Goal</Text>
          <Text style={styles.infoText}>10,000 steps</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${Math.min((recentStats.steps / 10000) * 100, 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.min(Math.round((recentStats.steps / 10000) * 100), 100)}% completed
          </Text>
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Statistics</Text>
          <StatsChart />
        </View>


  <View style={styles.infoCard}>
  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
    <Text style={styles.infoTitleMusic}>Music</Text>
    <Image
      source={require('../assets/images/spotify-icon.png')}
      style={{ width: 30, height: 30, resizeMode: 'contain', alignSelf: 'center' }}
    />
  </View>

  {token ? (
    track ? (    
      <View style={styles.trackInfo}>
        <Image
          source={{ uri: track.album.images[0].url }}
          style={styles.albumCover}
        />
        <View style={styles.trackDetails}>
          <Text style={styles.trackTitle}>{track.name}</Text>
          <Text style={styles.trackArtist}>{track.artists.map((a) => a.name).join(", ")}</Text>
        </View>
      </View>

     ) : ( 
      <View>
    <Text style={styles.infoText}>Listen to your favorite music while you workout</Text>
    <Button title="Connect to Spotify" onPress={handleLogin} />
    </View>
  )
    ) : (
      <View>
      <Text style={styles.infoText}>Listen to your favorite music while you workout</Text>
      <Button title="Connect to Spotify" onPress={handleLogin} />
      </View>
    )}
    </View>


        {recentStats.lastActivity && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Latest Activity</Text>
            <View style={styles.activityStats}>
              <View style={[styles.activityStatItem,{marginRight:15}]}>
                <Ionicons name="timer-outline" size={20} color="#666" />
                <Text style={[styles.activityStatValue,{width:80}]}>
                  {formatTime(recentStats.lastActivity.duration)}
                </Text>
                <Text style={styles.activityStatLabel}>Duration</Text>
              </View>
              <View style={styles.activityStatItem}>
                <Ionicons name="footsteps" size={20} color="#666" />
                <Text style={styles.activityStatValue}>
                  {recentStats.lastActivity.steps.toLocaleString()}
                </Text>
                <Text style={styles.activityStatLabel}>Steps</Text>
              </View>
              <View style={styles.activityStatItem}>
                <Ionicons name="flame" size={20} color="#666" />
                <Text style={styles.activityStatValue}>
                  {recentStats.lastActivity.calories.toFixed(0)}
                </Text>
                <Text style={styles.activityStatLabel}>Cal</Text>
              </View>
              <View style={styles.activityStatItem}>
                <Ionicons name="map" size={20} color="#666" />
                <Text style={styles.activityStatValue}>
                  {recentStats.lastActivity.distance.toFixed(0)}
                </Text>
                <Text style={styles.activityStatLabel}>KM</Text>
              </View>
            </View>
            <Text style={styles.activityDate}>
              {formatDate(recentStats.lastActivity.date)}
            </Text>
          </View>
        )}

        {activities.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Activity History</Text>
            {activities.map((activity, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyDate}>{formatDate(activity.date)}</Text>
                <View style={styles.historyStats}>
                  <Text style={styles.historyStatText}>
                    <Ionicons name="timer-outline" size={16} color="#666" /> {formatTime(activity.duration)}
                  </Text>
                  <Text style={styles.historyStatText}>
                    <Ionicons name="footsteps" size={16} color="#666" /> {activity.steps.toLocaleString()}
                  </Text>
                  <Text style={styles.historyStatText}>
                    <Ionicons name="flame" size={16} color="#666" /> {Number(activity.calories || 0).toFixed(0)} cal
                  </Text>
                  <Text style={styles.historyStatText}>
                    <Ionicons name="map" size={16} color="#666" /> {Number(activity.distance || 0).toFixed(0)} K
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  infoText: { fontSize: 14, color: "#666" },
  trackInfo: { flexDirection: "row", alignItems: "center", marginTop: 0 },
  albumCover: { width: 70, height: 70, borderRadius: 5, marginRight: 15 },
  trackDetails: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: "bold" },
  trackArtist: { fontSize: 14, color: "#666" },
  chartWrapper: {
    marginBottom: 20,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    alignSelf : 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  legendColor: {
    width: 15,
    height: 15,
    borderRadius: 8,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  chartContainer: {
    marginBottom: 20,
    width: '100%',
    alignContent: 'center', 
    backgroundColor: '#fff',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 20,
    padding: 10,
    marginLeft: 15,
    alignSelf:'flex-start',
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  chart: {
    marginVertical: 10,
    borderRadius: 15,
    alignSelf: 'center',
    marginRight:10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  statsContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stat: {
    alignItems: 'center',
 flex: 1, 
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  startButton: {
    backgroundColor: '#6bd425',
    borderRadius: 15,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 18,
  },
  infoTitleMusic: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    marginBottom: 10,
  },
  activityStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  activityStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 5,
  },
  activityStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  activityDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStatText: {
    fontSize: 14,
    color: '#333',
  },
});