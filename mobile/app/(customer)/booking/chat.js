import { SafeAreaView } from 'react-native-safe-area-context';
import ChatScreen from '../../../src/screens/shared/ChatScreen';

export default function CustomerChat() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ChatScreen />
    </SafeAreaView>
  );
}
