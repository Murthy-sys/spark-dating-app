import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList, Message } from '../../types';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToMessages,
  sendMessageSocket,
  sendImageMessage,
  getMessages,
  markAsRead,
  emitTyping,
  emitStopTyping,
  getSocket,
} from '../../services/chatService';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

export default function ChatScreen({ route }: Props) {
  const { matchId, otherUser } = route.params;
  const profile = useAuthStore((s) => s.profile);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const listRef = useRef<FlatList>(null);

  // Deduplicate helper — prevents the same message appearing twice
  // (can happen when socket delivers the echo AND REST fallback both add it)
  const addMessages = useCallback((incoming: Message | Message[]) => {
    const items = Array.isArray(incoming) ? incoming : [incoming];
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m._id));
      const newOnes = items.filter((m) => !existingIds.has(m._id));
      if (!newOnes.length) return prev;
      return [...prev, ...newOnes];
    });
  }, []);

  // Load messages from REST + re-load whenever socket reconnects
  const loadMessages = useCallback(async () => {
    try {
      const existing = await getMessages(matchId);
      setMessages(existing);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err) {
      console.error('[ChatScreen] Failed to load messages:', err);
    }
  }, [matchId]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // Initial load
    loadMessages();

    // Real-time subscription — re-joins room on every reconnect (fix in chatService)
    subscribeToMessages(matchId, (msg) => {
      addMessages(msg);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    // BUG FIX: Reload message history when socket reconnects.
    // The socket re-joins the room automatically (chatService fix), but we also
    // need to fetch any messages that arrived while disconnected.
    const socket = getSocket();
    const handleReconnect = () => loadMessages();
    socket?.on('connect', handleReconnect);

    markAsRead(matchId);

    return () => {
      cleanup?.();
      socket?.off('connect', handleReconnect);
    };
  }, [matchId, loadMessages, addMessages]);

  const handleSend = async () => {
    if (!text.trim() || !profile) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      // BUG FIX: sendMessageSocket now returns the saved message when falling
      // back to REST (socket was disconnected). Add it to state so the user
      // sees the message immediately even without socket echo.
      const savedMsg = await sendMessageSocket(matchId, msg);
      if (savedMsg) {
        addMessages(savedMsg);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err) {
      console.error('[ChatScreen] Failed to send message:', err);
      setText(msg); // restore text if send failed
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && profile) {
      setSending(true);
      try {
        const savedMsg = await sendImageMessage(matchId, result.assets[0].uri);
        addMessages(savedMsg);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err) {
        console.error('[ChatScreen] Failed to send image:', err);
      } finally {
        setSending(false);
      }
    }
  };

  const formatTime = (iso: string): string => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender === profile?._id;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        {!isMe && (
          <Image
            source={{ uri: otherUser.photoURL || 'https://placehold.co/60x60/eee/ccc?text=?' }}
            style={styles.msgAvatar}
          />
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {item.imageURL ? (
            <Image source={{ uri: item.imageURL }} style={styles.messageImage} />
          ) : (
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
              {item.text}
            </Text>
          )}
          <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
        {isMe && (
          <Image
            source={{ uri: profile?.photoURL || 'https://placehold.co/60x60/eee/ccc?text=?' }}
            style={styles.msgAvatar}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn}>
            <Text style={styles.attachIcon}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (t) emitTyping(matchId);
              else emitStopTyping(matchId);
            }}
            placeholder="Type a message…"
            placeholderTextColor="#aaa"
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8f8f8' },
  messageList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  messageRowMe:   { justifyContent: 'flex-end' },
  messageRowThem: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ddd',
    marginHorizontal: 6,
  },
  bubble: {
    maxWidth: '65%',
    padding: 12,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#FF4B6E',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText:    { fontSize: 15, color: '#1a1a1a', lineHeight: 20 },
  messageTextMe:  { color: '#fff' },
  messageImage:   { width: 200, height: 200, borderRadius: 12, resizeMode: 'cover' },
  timestamp:    { fontSize: 10, color: '#bbb', marginTop: 4, alignSelf: 'flex-end' },
  timestampMe:  { color: 'rgba(255,255,255,0.7)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  attachBtn: { padding: 6 },
  attachIcon: { fontSize: 22 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF4B6E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ffb3c0' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
