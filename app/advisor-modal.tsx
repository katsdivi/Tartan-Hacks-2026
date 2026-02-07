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
import Markdown from "react-native-markdown-display";
import FinanceTip from "@/components/FinanceTip";

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
        {isUser ? (
          <Text style={[styles.bubbleText, styles.userBubbleText]}>{message.content}</Text>
        ) : (
          <Markdown
            style={{
              body: { color: Colors.light.text, fontSize: 15, fontFamily: "DMSans_400Regular" },
              heading1: { fontSize: 18, fontFamily: "DMSans_700Bold", marginTop: 8, marginBottom: 4 },
              heading2: { fontSize: 16, fontFamily: "DMSans_600SemiBold", marginTop: 6, marginBottom: 3 },
              heading3: { fontSize: 15, fontFamily: "DMSans_600SemiBold", marginTop: 4, marginBottom: 2 },
              strong: { fontFamily: "DMSans_700Bold" },
              em: { fontFamily: "DMSans_400Regular", fontStyle: "italic" },
              bullet_list: { marginTop: 4, marginBottom: 4 },
              ordered_list: { marginTop: 4, marginBottom: 4 },
              list_item: { marginTop: 2, marginBottom: 2 },
              code_inline: {
                backgroundColor: Colors.light.borderLight,
                color: Colors.light.tint,
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
                fontFamily: "Courier",
              },
              code_block: {
                backgroundColor: Colors.light.borderLight,
                padding: 8,
                borderRadius: 6,
                marginTop: 4,
                marginBottom: 4,
              },
              fence: {
                backgroundColor: Colors.light.borderLight,
                padding: 8,
                borderRadius: 6,
                marginTop: 4,
                marginBottom: 4,
              },
            }}
          >
            {message.content}
          </Markdown>
        )}
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View>
      <View style={[styles.bubbleContainer, styles.assistantBubbleContainer]}>
        <View style={styles.avatarWrap}>
          <Ionicons name="sparkles" size={16} color={Colors.light.tint} />
        </View>
        <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
          <ActivityIndicator size="small" color={Colors.light.tint} />
          <Text style={styles.typingText}>Analyzing...</Text>
        </View>
      </View>
      <View style={styles.tipWrap}>
        <FinanceTip />
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
      const DEDALUS_API_KEY = process.env.EXPO_PUBLIC_DEDALUS_API_KEY;
      if (!DEDALUS_API_KEY) {
        throw new Error("DEDALUS_API_KEY is not set in environment variables.");
      }

      const DEDALUS_API_URL = "https://api.dedaluslabs.ai/v1/chat/completions";

      const financialContext = getFinancialContext();
      const system_prompt = `You are Origin, a professional AI financial advisor. You provide personalized, actionable financial guidance.

${financialContext ? `Here is the user's current financial data:\n${financialContext}\n\nUse this data to provide specific, personalized advice.` : "The user hasn't connected their bank account yet. Encourage them to connect it for personalized advice, but still provide general financial guidance."}

Guidelines:
- Be concise but thorough
- Give specific, actionable recommendations
- Use numbers and percentages when relevant
- Be encouraging but realistic
- Format responses with clear structure
- Never provide specific investment advice or stock picks
- Focus on budgeting, saving, debt management, and financial planning`;


      // Convert messages to OpenAI-compatible format for Dedalus Labs
      const dedalusMessages = [
        { role: 'system', content: system_prompt }
      ];

      // Append existing chat history
      for (const message of currentMessages) {
        dedalusMessages.push({
          role: message.role,
          content: message.content
        });
      }
      // Add the current user message
      dedalusMessages.push({ role: 'user', content: messageText });


      const response = await fetch(DEDALUS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEDALUS_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: dedalusMessages,
          stream: true,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Dedalus API error response:", errorBody);
        throw new Error(`Dedalus API returned an error: ${response.status} ${response.statusText}`);
      }

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
        // Dedalus API uses Server-Sent Events format with "data: " prefix
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.substring(6); // Remove "data: " prefix
          if (data === '[DONE]') continue; // Stream finished signal

          try {
            const parsed = JSON.parse(data);
            // Extract content from OpenAI-compatible format
            const chunkContent = parsed.choices?.[0]?.delta?.content;

            if (chunkContent) {
              fullContent += chunkContent;

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
          } catch (e) {
            console.error("Error parsing Dedalus stream chunk:", e, data);
          }
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
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          inverted
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
  tipWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
