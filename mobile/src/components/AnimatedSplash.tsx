import React from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';

// Plays the real splash video once over the app's launch fonts/auth
// loading, then calls onFinish. _layout.tsx keeps this overlaid until
// BOTH the video and the real app are ready, whichever is longer, so a
// slow network never cuts the video off mid-play.
const splashVideo = require('../../assets/videos/splash.mp4');

export default function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const player = useVideoPlayer(splashVideo, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  useEventListener(player, 'playToEnd', () => {
    onFinish();
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F5F2',
    zIndex: 999,
  },
});
