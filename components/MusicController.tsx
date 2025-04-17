// components/MusicController.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MusicControllerProps {
  track: any;
  isPlaying: boolean;
  onPress?: () => void; 
}

export const FloatingMusicController: React.FC<MusicControllerProps> = ({
  track,
  isPlaying,
  onPress,
}) => {
  if (!track) return null;

  

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Ionicons 
          name={isPlaying ? "musical-notes" : "musical-note"} 
          size={16} 
          color="#fff" 
        />
        <Text style={styles.trackName} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {track.artists[0].name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxWidth: '80%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackName: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  artistName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
  },
  separator: {
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
});