import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Image, Dimensions } from 'react-native'
import React from 'react'
import { Link, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { push } from 'expo-router/build/global-state/routing'

const Intro = () => {
  const navigation = useNavigation();
  const handlePress = () => {
    navigation.replace('dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image 
        source={require('../assets/images/intro-img.png')}
        style={styles.introImage}
        resizeMode="cover"
      />
      <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handlePress}>
            <Text style={styles.buttonText}>Let's Goo</Text>
            <Image 
              source={require('../assets/images/arrow.png')}
              style={{ width: 35, height: 25 }}
            />
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

export default Intro

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  introImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'absolute',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#233ce6',
    paddingHorizontal:40,
    paddingVertical: 10,
    borderRadius: 15,
    width: '70%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#233ce6', 
    textTransform: 'uppercase',
    fontSize: 20,
    marginRight: 20,
    fontWeight: '800',
    textAlign: 'center',
  }
})