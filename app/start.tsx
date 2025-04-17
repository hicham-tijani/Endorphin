import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Polyline } from 'react-native-maps';
import CustomMaps from '../components/CustomMaps.json';
import { FloatingMusicController } from '@/components/MusicController';
import { Pedometer } from 'expo-pedometer';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, startAsync } from 'expo-auth-session';

const STORAGE_KEY = '@fitness_stats';
const ACTIVITIES_KEY = '@fitness_activities';
const { width, height } = Dimensions.get('window');

// Step detection constants
const STEP_THRESHOLD = 1.2; // Acceleration magnitude threshold (m/s²)
const STEP_DELAY = 300; // Minimum time between steps (ms)

const CLIENT_ID = "a8cc75b6d0594b448e65e5b6d37713f6";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const RESPONSE_TYPE = "token";
const SCOPES = "user-read-playback-state user-modify-playback-state streaming";

export default function TrackingScreen() {
  const router = useRouter();
  const [isTracking, setIsTracking] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastStepTime, setLastStepTime] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [path, setPath] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMusicDetails, setShowMusicDetails] = useState(false);
  const [cadence, setCadence] = useState(0); // Steps per minute
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState('');
  const [isSpotifyAuthorized, setIsSpotifyAuthorized] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState('');

  // Spotify controls
  const handlePlayPause = async () => {
    try {
      const token = await AsyncStorage.getItem('@spotify_token');
      if (!token) return;
  
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/${isPlaying ? 'pause' : 'play'}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.ok) {
        setIsPlaying(!isPlaying);
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };
  
  const handleSkipNext = async () => {
    try {
      const token = await AsyncStorage.getItem('@spotify_token');
      if (!token) return;
  
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/next',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.ok) {
        setTimeout(fetchCurrentTrack, 500);
      }
    } catch (error) {
      console.error('Error skipping next:', error);
    }
  };
  
  const handleSkipPrevious = async () => {
    try {
      const token = await AsyncStorage.getItem('@spotify_token');
      if (!token) return;
  
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/previous',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.ok) {
        setTimeout(fetchCurrentTrack, 500);
      }
    } catch (error) {
      console.error('Error skipping previous:', error);
    }
  };

  const fetchCurrentTrack = async () => {
    try {
      const token = await AsyncStorage.getItem('@spotify_token');
      if (!token) return;
  
      const response = await fetch(
        'https://api.spotify.com/v1/me/player/currently-playing',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.status === 200) {
        const data = await response.json();
        setCurrentTrack(data.item);
        setIsPlaying(data.is_playing);
      }
    } catch (error) {
      console.error('Error fetching current track:', error);
    }
  };

  useEffect(() => {
    fetchCurrentTrack();
    const interval = setInterval(fetchCurrentTrack, 10000);
    return () => clearInterval(interval);
  }, []);

  const detectStep = (acceleration: { x: number; y: number; z: number }) => {
    const magnitude = Math.sqrt(
      acceleration.x * acceleration.x +
      acceleration.y * acceleration.y +
      acceleration.z * acceleration.z
    );

    const currentTime = Date.now();
    if (magnitude > STEP_THRESHOLD && currentTime - lastStepTime > STEP_DELAY) {
      setLastStepTime(currentTime);
      setSteps(prev => {
        const newSteps = prev + 1;
        const distanceInKm = (newSteps * 0.762) / 1000; // Average stride length
        setDistance(distanceInKm);
        const caloriesBurned = newSteps * 0.04; // Rough estimate
        setCalories(caloriesBurned);
        console.log('Steps:', newSteps);
        return newSteps;
      });
    }
  };

  const setupAccelerometer = useCallback(async () => {
    try {
      await Accelerometer.setUpdateInterval(100); // Update every 100ms

      const accelerometerSubscription = Accelerometer.addListener(acceleration => {
        if (!isPaused) {
          detectStep(acceleration);
        }
      });

      setSubscription(accelerometerSubscription);
      setIsTracking(true);
    } catch (error) {
      console.log('Error setting up accelerometer:', error);
    }
  }, [isPaused, lastStepTime]);

  const setupLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
  
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (newLocation) => {
          setLocation(newLocation);
          setPath((prevPath) => [
            ...prevPath,
            { latitude: newLocation.coords.latitude, longitude: newLocation.coords.longitude }
          ]);
        }
      );
  
      return locationSubscription;
    } catch (error) {
      console.log('Error setting up location:', error);
    }
  }, []);
  

  useEffect(() => {
    let locationSubscription: any;
    let timer: NodeJS.Timeout;

    const startTracking = async () => {
      await setupAccelerometer();
      locationSubscription = await setupLocation();
    };

    startTracking();

    timer = setInterval(() => {
      if (!isPaused) {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);

    
    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isPaused, setupAccelerometer, setupLocation]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleStopTracking = async () => {
    setIsTracking(false);
    if (subscription) {
      subscription.remove();
    }

    try {
      const activityData = {
        date: new Date().toISOString(),
        duration: elapsedTime,
        steps,
        distance,
        calories,
        endLocation: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        } : null,
      };

      const existingActivities = await AsyncStorage.getItem(ACTIVITIES_KEY);
      const activities = existingActivities ? JSON.parse(existingActivities) : [];
      activities.unshift(activityData);
      
      await AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        steps,
        distance,
        calories,
        lastActivity: activityData,
      }));

      router.back();
    } catch (error) {
      console.log('Error saving activity:', error);
    }
  };

  const handleSpotifyAuth = async () => {
    try {
      setIsAuthorizing(true);
      
      // Get the correct redirect URI
      const redirectUri = AuthSession.makeRedirectUri({
        useProxy: process.env.EXPO_DEV, // True in Expo Go, False in Standalone
        native: "Endorphin://auth", // Custom deep link for production
      });

      const result = await AuthSession.startAsync({
        authUrl: `${AUTH_ENDPOINT}?${new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: RESPONSE_TYPE,
          scope: SCOPES,
          show_dialog: 'true',
        })}`,
      });

      if (result.type === 'success') {
        const { access_token } = result.params;
        setSpotifyToken(access_token);
        setIsSpotifyAuthorized(true);
        await SecureStore.setItemAsync('spotify_token', access_token);
      } else {
        console.log('Spotify auth failed:', result);
      }
    } catch (error) {
      console.error('Spotify auth error:', error);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleArtistSelect = (artist: string): void => {
    setSelectedArtist(artist);
    setShowMusicDetails(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Track Activity',
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerShadowVisible: false,
        }}
      />
    <View style={styles.content}>

        
      {currentTrack && (
    <>
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
    <FloatingMusicController
      track={currentTrack}
      isPlaying={isPlaying}
      onPress={() => setShowMusicDetails(!showMusicDetails)}
    />
  </View>
      
{/* Expanded music view that appears when clicked */}
{showMusicDetails && (
  <View style={styles.expandedMusicContainer}>
    <View style={styles.expandedMusicView}>
      <View style={styles.musicHeader}>
        <Image 
          source={{ uri: currentTrack?.album?.images?.[0]?.url }} 
          style={styles.expandedAlbumArt} 
        />
        <View style={styles.trackInfo}>
          <Text style={styles.expandedTrackName} numberOfLines={1}>
            {currentTrack?.name}
          </Text>
          <Text style={styles.expandedArtistName} numberOfLines={1}>
            {currentTrack?.artists?.map(artist => artist.name).join(', ')}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShowMusicDetails(false)}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.musicControls}>
        <TouchableOpacity onPress={handleSkipPrevious}>
          <Ionicons name="play-skip-back" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handlePlayPause} style={styles.playPauseButton}>
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={21} 
            color="#fff" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleSkipNext}>
          <Ionicons name="play-skip-forward" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}
     
    </>
  )}



        {location && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              pointerEvents="none"
              pitchEnabled={true} 
              rotateEnabled={true} 
              showsBuildings={true} 
              showsUserLocation
              showsMyLocationButton
              showsCompass
              mapType="standard"
              initialCamera={{
                center: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                },
                pitch: 45,
                heading: 0,
                zoom: 19,
                
                altitude: 1000,
              }}
            >

            <Polyline
              coordinates={path}
              strokeWidth={8}
              strokeColor="#233ce6"
            />

            </MapView>            
          </View>
        )}




        <BlurView intensity={80} style={styles.statsContainer}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerValue}>{formatTime(elapsedTime)}</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="footsteps" size={32} color="#4458e4" />
              <Text style={styles.statValue}>{steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="flame" size={32} color="#33e834" />
              <Text style={styles.statValue}>{calories.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="map-outline" size={32} color="#233ce6" />
              <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>KM</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButtonOutline, { backgroundColor: isPaused ? 'transparent' : '#transparent' }]}
              onPress={handlePauseResume}
            >
              <Ionicons name={isPaused ? "play" : "pause"} size={24} color="#4458e4" />
              <Text style={styles.actionButtonOutlineText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#aaf683' }]}
              onPress={handleStopTracking}
            >
              <Ionicons name="stop-circle" size={24} color="#1b998b" />
              <Text style={styles.actionButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  expandedMusicContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10001,
    alignItems: 'center',
  },
  expandedMusicView: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 12,
    width: '70%',
  },
  musicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  expandedAlbumArt: {
    width: 36,
    height: 36,
    borderRadius: 4,
    marginRight: 20,
  },
  trackInfo: {
    flex: 1,
  },
  expandedTrackName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  expandedArtistName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  musicControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  playPauseButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    marginLeft: 10,
    paddingBottom: 17,
  },
  musicControllerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  expandedTrackInfo: {
    flex: 1,
  },
  
  container: {
    flex: 1,
    backgroundColor: 'lightgrey',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
flex: 1, 
    height: height * 0.5,
    
  },
  map: {
    width: '100%',
    height: '100%',
  },
  statsContainer: {
      position: 'absolute',
      bottom: 0,
      height: height * 0.5,
      width: '100%',
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      overflow: 'hidden',
      padding: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slight transparency
      shadowColor: '#000', // Shadow color
      shadowOffset: { width: 0, height: 3 }, // Shadow offset
      shadowOpacity: 0.3, // Shadow opacity
      shadowRadius: 10, // Blur radius
      elevation: 10, // Android shadow
    
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  timerValue: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10,
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
    flex: 0.45,
  },
  actionButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
    flex: 0.45,
    borderWidth: 1.2,
    borderColor: 'blue',
  },
  actionButtonOutlineText: {
    color: '#4458e4',
    textTransform: 'uppercase',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  actionButtonText: {
    color: '#1b998b',
    textTransform: 'uppercase',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});