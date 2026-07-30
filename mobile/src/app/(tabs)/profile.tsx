import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-surface justify-center items-center">
      <Text className="text-2xl font-bold text-primary mb-8">Profile</Text>
      
      <TouchableOpacity 
        className="px-6 py-3 bg-white border border-slate-300 rounded-lg shadow-sm"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="text-primary font-medium">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
