import { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import { useFinance } from "@/lib/finance-context";
import Colors from "@/constants/colors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let messageCounter = 0;
function generateUniqueId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

const QUICK_PROMPTS = [
  "How can I save more?",
  "Review my spending",
  "Create a savings plan",
  "Debt payoff strategy",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.bubbleContainer, isUser ? styles.userBubbleContainer : styles.assistantBubbleContainer]}>
      {!isUser && (
        <View style={styles.avatarWrap}>
          <Ionicons name="sparkles" size={16} color={Colors.light.tint} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.content}</Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleContainer, styles.assistantBubbleContainer]}>
      <View style={styles.avatarWrap}>
        <Ionicons name="sparkles" size={16} color={Colors.light.tint} />
      </View>
      <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
        <ActivityIndicator size="small" color={Colors.light.tint} />
        <Text style={styles.typingText}>Analyzing...</Text>
      </View>
    </View>
  );
}

export default function AdvisorModalScreen() {
  const insets = useSafeAreaInsets();
  const { getFinancialContext, isConnected } = useFinance();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    const currentMessages = [...messages];
    const userMessage: Message = {
      id: generateUniqueId(),
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setShowTyping(true);

    try {
      const baseUrl = getApiUrl();
      const chatHistory = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: messageText },
      ];

      const financialContext = getFinancialContext();

      const response = await fetch(`${baseUrl}api/advisor/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages: chatHistory,
          financialContext,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      let assistantAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;

              if (!assistantAdded) {
                setShowTyping(false);
                setMessages((prev) => [...prev, {
                  id: generateUniqueId(),
                  role: "assistant",
                  content: fullContent,
                }]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            }
          } catch {}
        }
      }
    } catch (error) {
      setShowTyping(false);
      setMessages((prev) => [...prev, {
        id: generateUniqueId(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again.",
      }]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
    }
  }, [input, messages, isStreaming, getFinancialContext]);

  const reversedMessages = [...messages].reverse();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topInset }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={styles.headerSection}>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>AI Advisor</Text>
        {isConnected ? (
          <View style={styles.dataBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.dataBadgeText}>Live</Text>
          </View>
        ) : (
          <View style={[styles.dataBadge, { backgroundColor: Colors.light.accentLight }]}>
            <Text style={[styles.dataBadgeText, { color: Colors.light.accent }]}>General</Text>
          </View>
        )}
      </View>

      {messages.length === 0 ? (
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeIconWrap}>
            <Ionicons name="sparkles" size={36} color={Colors.light.tint} />
          </View>
          <Text style={styles.welcomeTitle}>Financial Advisor</Text>
          <Text style={styles.welcomeSubtitle}>
            {isConnected
              ? "I can analyze your accounts, spending patterns, and help you reach your financial goals."
              : "Connect your bank account for personalized advice, or ask me general finance questions."}
          </Text>
          <View style={styles.quickPromptsGrid}>
            {QUICK_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt}
                style={({ pressed }) => [styles.quickPrompt, pressed && { opacity: 0.7 }]}
                onPress={() => handleSend(prompt)}
              >
                <Text style={styles.quickPromptText}>{prompt}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.light.tint} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          inverted={messages.length > 0}
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.inputContainer, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your finances..."
            placeholderTextColor={Colors.light.textTertiary}
            multiline
            maxLength={500}
            blurOnSubmit={false}
            onSubmitEditing={() => handleSend()}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || isStreaming) && styles.sendButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              handleSend();
              inputRef.current?.focus();
            }}
            disabled={!input.trim() || isStreaming}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={input.trim() && !isStreaming ? Colors.light.background : Colors.light.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  dataBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.positiveLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.positive,
  },
  dataBadgeText: {
    fontSize: 11,
    fontFamily: "DMSans_600SemiBold",
    color: Colors.light.positive,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
    paddingBottom: 40,
  },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 22,
    fontFamily: "DMSans_700Bold",
    color: Colors.light.text,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  quickPromptsGrid: {
    width: "100%",
    gap: 8,
    marginTop: 12,
  },
  quickPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickPromptText: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
    color: Colors.light.text,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bubbleContainer: {
    flexDirection: "row",
    marginVertical: 4,
    maxWidth: "85%",
  },
  userBubbleContainer: {
    alignSelf: "flex-end",
  },
  assistantBubbleContainer: {
    alignSelf: "flex-start",
    gap: 8,
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: "100%",
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: Colors.light.tint,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.light.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.text,
    lineHeight: 22,
  },
  userBubbleText: {
    color: Colors.light.background,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  typingText: {
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.textSecondary,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: Colors.light.text,
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.borderLight,
  },
});
