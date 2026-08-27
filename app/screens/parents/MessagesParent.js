import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Share,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonListItem } from "../../components/common/SkeletonLoader";
import { getParentData, getParentNotices } from "../../services/dataService";
import useRefreshOnForeground from "../../hooks/useRefreshOnForeground";
import { showToast } from "../../utils/toastService";

const INITIAL_PARENT_CHATS = [];

const OFFICIAL_NOTICES = [];

const DEFAULT_CATEGORIES = ["All Notices"];

export default function MessagesParent() {
  const { colors, isDarkMode } = useTheme();
  const styles = getStyles(colors, isDarkMode);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active View: 'notices' | 'chat'
  const [activeView, setActiveView] = useState("notices");
  const [selectedCategory, setSelectedCategory] = useState("All Notices");
  const [searchQuery, setSearchQuery] = useState("");

  // Counselor Chat
  const [chatMessages, setChatMessages] = useState(INITIAL_PARENT_CHATS);
  const [notices, setNotices] = useState(OFFICIAL_NOTICES);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [parentName, setParentName] = useState("");
  const [newMsgText, setNewMsgText] = useState("");

  // Notice Inspection Modal
  const [selectedNotice, setSelectedNotice] = useState(null);

  // Counselor Info
  const [advisorInfo, setAdvisorInfo] = useState({
    name: "",
    cabin: "",
    phone: "",
    email: "",
  });

  const loadData = useCallback(async () => {
    try {
      const data = await getParentData();
      if (data) {
        if (data.parentName) setParentName(data.parentName);
        if (data.ward?.advisor) {
          setAdvisorInfo((prev) => ({
            ...prev,
            name: data.ward.advisor.name || prev.name,
            phone: data.ward.advisor.phone || prev.phone,
            email: data.ward.advisor.email || prev.email,
            cabin: data.ward.advisor.cabin || prev.cabin,
          }));
        }
        if (data.department) {
          setAdvisorInfo((prev) => ({
            ...prev,
            cabin: prev.cabin || `${data.department} Office`,
          }));
        }
      }

      try {
        const noticesData = await getParentNotices();
        if (Array.isArray(noticesData)) {
          const categorySet = new Set(["All Notices"]);
          const mapped = noticesData.map((n, idx) => {
            const category = n.category || n.type || "General";
            categorySet.add(category);
            return {
              id: n.id || `notice_${idx}`,
              title: n.title || n.subject || "Campus Notice",
              content: n.content || n.message || n.body || "",
              sender: n.sender || n.from || "Administration",
              date: n.date || n.createdAt || "",
              category,
              color: n.color || "#4F46E5",
              icon: n.icon || "bullhorn-outline",
              time: n.time || n.date || "",
              isNew: n.isNew || false,
            };
          });
          setNotices(mapped);
          setCategories(Array.from(categorySet));
        }
      } catch (e) {
        console.warn("MessagesParent notices load error:", e?.message || e);
      }

      const savedChat = await AsyncStorage.getItem("parent_advisor_chat_v1");
      if (savedChat) {
        setChatMessages(JSON.parse(savedChat));
      }
    } catch (err) {
      console.warn("MessagesParent load error:", err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRefreshOnForeground(loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Send Direct Message to Counselor
  const handleSendMessage = async () => {
    if (!newMsgText.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msg = {
      id: `pc_${Date.now()}`,
      sender: parentName || "You",
      role: "Parent / Guardian",
      time: `Today · ${time}`,
      text: newMsgText.trim(),
      isFaculty: false,
    };

    const updated = [...chatMessages, msg];
    setChatMessages(updated);
    setNewMsgText("");
    await AsyncStorage.setItem("parent_advisor_chat_v1", JSON.stringify(updated));
    showToast("Message sent to Class Counselor!", "success");
  };

  const handleCallAdvisor = () => {
    if (!advisorInfo.phone) return;
    Linking.openURL(`tel:${advisorInfo.phone}`).catch(() => {
      Alert.alert("Call Error", `Cannot dial ${advisorInfo.phone}`);
    });
  };

  const handleEmailAdvisor = () => {
    if (!advisorInfo.email) return;
    Linking.openURL(`mailto:${advisorInfo.email}?subject=Parent%20Inquiry%20from%20${encodeURIComponent(parentName || "Parent")}`).catch(() => {
      Alert.alert("Email Error", `Cannot open mail client for ${advisorInfo.email}`);
    });
  };

  const handleShareNotice = async (notice) => {
    try {
      await Share.share({
        title: `Campus Notice: ${notice.title}`,
        message: `📢 EDUNEX CAMPUS CIRCULAR\nTitle: ${notice.title}\nCategory: ${notice.category}\nDate: ${notice.date}\nAuthority: ${notice.sender}\n\n${notice.content}`,
      });
      showToast("Notice shared!", "success");
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  // Filtered Notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (selectedCategory !== "All Notices" && n.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (n.title || "").toLowerCase().includes(q);
        const matchContent = (n.content || "").toLowerCase().includes(q);
        const matchSender = (n.sender || "").toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchSender) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery, notices]);

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryAccent]}
            tintColor={colors.primaryAccent}
            progressBackgroundColor={colors.cardBackground}
          />
        }
      >
        {/* ========================================================================= */}
        {/* 1. HEADER                                                                 */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryAccent + "18" }]}>
            <Icon name="message-badge-outline" size={24} color={colors.primaryAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Communication Hub</Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Faculty Counselor Hotline & Institutional Circulars
            </Text>
          </View>
        </View>

        {/* View Switcher: Notices vs Counselor Chat */}
        <View style={[styles.viewSwitcher, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <TouchableOpacity
            style={[
              styles.viewTab,
              activeView === "notices" && { backgroundColor: colors.primaryAccent },
            ]}
            onPress={() => setActiveView("notices")}
          >
            <Icon
              name="bullhorn-outline"
              size={16}
              color={activeView === "notices" ? "#FFFFFF" : colors.secondaryText}
            />
            <Text
              style={[
                styles.viewTabText,
                { color: activeView === "notices" ? "#FFFFFF" : colors.primaryText },
              ]}
            >
              Campus Notices ({notices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewTab,
              activeView === "chat" && { backgroundColor: colors.primaryAccent },
            ]}
            onPress={() => setActiveView("chat")}
          >
            <Icon
              name="account-tie-voice-outline"
              size={16}
              color={activeView === "chat" ? "#FFFFFF" : colors.secondaryText}
            />
            <Text
              style={[
                styles.viewTabText,
                { color: activeView === "chat" ? "#FFFFFF" : colors.primaryText },
              ]}
            >
              Counselor Chat
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 10 }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 2. VIEW 1: CAMPUS NOTICES & CIRCULARS                                     */}
            {/* ========================================================================= */}
            {activeView === "notices" && (
              <View>
                {/* Category Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginBottom: 10 }}
                >
                    {categories.map((cat) => {
                    const isSel = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryPill,
                          isSel
                            ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                            : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                        ]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: isSel ? "#FFFFFF" : colors.primaryText },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Search Bar */}
                <View style={[styles.searchBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Icon name="magnify" size={18} color={colors.secondaryText} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.primaryText }]}
                    placeholder="Search circulars by keyword, exam or date..."
                    placeholderTextColor={colors.disabledText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Icon name="close-circle" size={16} color={colors.secondaryText} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Notices List */}
                <View style={{ gap: 10 }}>
                  {filteredNotices.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.noticeCard,
                        {
                          backgroundColor: colors.cardBackground,
                          borderColor: item.isNew ? colors.primaryAccent : colors.divider,
                        },
                      ]}
                      onPress={() => setSelectedNotice(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.noticeCardTop}>
                        <View style={[styles.noticeIconCircle, { backgroundColor: `${item.color}18` }]}>
                          <Icon name={item.icon} size={22} color={item.color} />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={[styles.noticeCatText, { color: item.color }]}>{item.category}</Text>
                            {item.isNew && (
                              <View style={[styles.newBadge, { backgroundColor: colors.primaryAccent }]}>
                                <Text style={styles.newBadgeText}>NEW</Text>
                              </View>
                            )}
                          </View>

                          <Text style={[styles.noticeTitleText, { color: colors.primaryText }]} numberOfLines={2}>
                            {item.title}
                          </Text>

                          <Text style={[styles.noticeSenderText, { color: colors.secondaryText }]}>
                            {item.sender} · {item.date}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.noticePreviewText, { color: colors.disabledText }]} numberOfLines={2}>
                        {item.content}
                      </Text>

                      <View style={[styles.noticeCardBottom, { borderTopColor: colors.divider }]}>
                        <Text style={[styles.readMoreText, { color: colors.primaryAccent }]}>Read Official Notice</Text>
                        <Icon name="chevron-right" size={16} color={colors.primaryAccent} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ========================================================================= */}
            {/* 3. VIEW 2: COUNSELOR DIRECT 1-ON-1 CHAT                                   */}
            {/* ========================================================================= */}
            {activeView === "chat" && (
              <View>
                {/* Advisor Profile Banner */}
                <View style={[styles.advisorBanner, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.advisorBannerTop}>
                    <View style={[styles.advisorAvatarCircle, { backgroundColor: colors.primaryAccent }]}>
                      <Icon name="account-tie" size={24} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.advisorBannerName, { color: colors.primaryText }]}>
                        {advisorInfo.name}
                      </Text>
                      <Text style={[styles.advisorBannerDept, { color: colors.primaryAccent }]}>
                        {advisorInfo.name ? `Class Advisor` : "No Advisor Assigned"}
                      </Text>
                      <Text style={[styles.advisorBannerCabin, { color: colors.secondaryText }]}>
                        {advisorInfo.cabin}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.advisorContactActions}>
                    <TouchableOpacity
                      style={[styles.advisorContactBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                      onPress={handleCallAdvisor}
                    >
                      <Icon name="phone" size={16} color={colors.primaryAccent} />
                      <Text style={[styles.advisorContactBtnText, { color: colors.primaryAccent }]}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.advisorContactBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                      onPress={handleEmailAdvisor}
                    >
                      <Icon name="email-outline" size={16} color={colors.primaryAccent} />
                      <Text style={[styles.advisorContactBtnText, { color: colors.primaryAccent }]}>Email</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Chat Bubbles */}
                <View style={[styles.chatBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <View style={styles.chatE2EENotice}>
                    <Icon name="lock-check" size={13} color="#10B981" />
                    <Text style={[styles.chatE2EENoticeText, { color: colors.secondaryText }]}>
                      Direct academic counseling channel between Parent & Faculty.
                    </Text>
                  </View>

                  <View style={{ gap: 10, paddingVertical: 10 }}>
                    {chatMessages.map((msg) => (
                      <View
                        key={msg.id}
                        style={[
                          styles.chatBubble,
                          msg.isFaculty
                            ? [styles.facultyBubble, { backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9", borderColor: colors.divider }]
                            : [styles.parentBubble, { backgroundColor: colors.primaryAccent }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.chatSenderName,
                            { color: msg.isFaculty ? colors.primaryAccent : "rgba(255,255,255,0.85)" },
                          ]}
                        >
                          {msg.sender}
                        </Text>
                        <Text
                          style={[
                            styles.chatMsgText,
                            { color: msg.isFaculty ? (isDarkMode ? "#F8FAFC" : "#0F172A") : "#FFFFFF" },
                          ]}
                        >
                          {msg.text}
                        </Text>
                        <Text
                          style={[
                            styles.chatTimeText,
                            { color: msg.isFaculty ? colors.disabledText : "rgba(255,255,255,0.7)" },
                          ]}
                        >
                          {msg.time}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Input Box */}
                  <View style={[styles.chatInputWrap, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                    <TextInput
                      style={[styles.chatInput, { color: colors.primaryText }]}
                      placeholder="Type a message..."
                      placeholderTextColor={colors.disabledText}
                      value={newMsgText}
                      onChangeText={setNewMsgText}
                      multiline
                    />
                    <TouchableOpacity
                      style={[
                        styles.sendBtn,
                        { backgroundColor: newMsgText.trim() ? colors.primaryAccent : colors.divider },
                      ]}
                      onPress={handleSendMessage}
                      disabled={!newMsgText.trim()}
                    >
                      <Icon name="send" size={18} color={newMsgText.trim() ? "#FFFFFF" : colors.disabledText} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================================= */}
            {/* 4. EMERGENCY CAMPUS HELPDESK                                              */}
            {/* ========================================================================= */}
            <View style={[styles.helpdeskCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Text style={[styles.helpdeskTitle, { color: colors.primaryText }]}>Campus Administrative Helpdesk</Text>
              <Text style={[styles.helpdeskSub, { color: colors.secondaryText }]}>
                Office of the Principal & Student Welfare (Mon - Sat, 08:30 - 17:00)
              </Text>

              <View style={styles.helpdeskActionsRow}>
                <TouchableOpacity
                  style={[styles.helpdeskBtn, { borderColor: colors.divider }]}
                  onPress={() => advisorInfo.phone && Linking.openURL(`tel:${advisorInfo.phone}`)}
                >
                  <Icon name="phone" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.helpdeskBtnText, { color: colors.primaryAccent }]}>{advisorInfo.phone ? `Office: ${advisorInfo.phone}` : "No Phone Available"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.helpdeskBtn, { borderColor: colors.divider }]}
                  onPress={() => advisorInfo.email && Linking.openURL(`mailto:${advisorInfo.email}`)}
                >
                  <Icon name="email-outline" size={16} color={colors.primaryAccent} />
                  <Text style={[styles.helpdeskBtnText, { color: colors.primaryAccent }]}>{advisorInfo.email || "No Email Available"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* 5. NOTICE INSPECTION DETAIL MODAL                                         */}
      {/* ========================================================================= */}
      {selectedNotice && (
        <Modal
          visible={!!selectedNotice}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedNotice(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.noticeIconCircle, { backgroundColor: `${selectedNotice.color}18` }]}>
                    <Icon name={selectedNotice.icon} size={22} color={selectedNotice.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalCatText, { color: selectedNotice.color }]}>{selectedNotice.category}</Text>
                    <Text style={[styles.modalTitleText, { color: colors.primaryText }]} numberOfLines={2}>
                      {selectedNotice.title}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setSelectedNotice(null)}>
                  <Icon name="close-circle-outline" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
                <View style={[styles.noticeMetaBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Issued By</Text>
                    <Text style={[styles.metaVal, { color: colors.primaryText }]}>{selectedNotice.sender}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaKey, { color: colors.secondaryText }]}>Date & Time</Text>
                    <Text style={[styles.metaVal, { color: colors.primaryText }]}>
                      {selectedNotice.date} · {selectedNotice.time}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalBodyText, { color: colors.primaryText }]}>
                  {selectedNotice.content}
                </Text>
              </ScrollView>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.shareNoticeBtn, { backgroundColor: colors.primaryAccent }]}
                  onPress={() => handleShareNotice(selectedNotice)}
                  activeOpacity={0.85}
                >
                  <Icon name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareNoticeBtnText}>Share Notice</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor: colors.divider }]}
                  onPress={() => setSelectedNotice(null)}
                >
                  <Text style={[styles.closeModalBtnText, { color: colors.primaryText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ---------------- Styles ----------------
const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 80 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      marginTop: 2,
    },

    /* View Switcher */
    viewSwitcher: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      padding: 4,
      marginBottom: 14,
    },
    viewTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    viewTabText: {
      fontSize: 12,
      fontWeight: "800",
    },

    /* Category Pills */
    categoryPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    categoryPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Search Box */
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      padding: 0,
    },

    /* Notice Cards */
    noticeCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      elevation: 2,
    },
    noticeCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    noticeIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    noticeCatText: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    newBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    newBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },
    noticeTitleText: {
      fontSize: 13.5,
      fontWeight: "800",
      marginTop: 2,
    },
    noticeSenderText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    noticePreviewText: {
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 8,
    },
    noticeCardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      marginTop: 10,
      paddingTop: 8,
    },
    readMoreText: {
      fontSize: 11.5,
      fontWeight: "700",
    },

    /* Advisor Banner */
    advisorBanner: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    advisorBannerTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    advisorAvatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    advisorBannerName: {
      fontSize: 14.5,
      fontWeight: "800",
    },
    advisorBannerDept: {
      fontSize: 11.5,
      fontWeight: "700",
      marginTop: 1,
    },
    advisorBannerCabin: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    advisorContactActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    advisorContactBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    advisorContactBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },

    /* Chat Box */
    chatBox: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 14,
    },
    chatE2EENotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(150,150,150,0.15)",
    },
    chatE2EENoticeText: {
      fontSize: 10.5,
      fontWeight: "600",
    },
    chatBubble: {
      borderRadius: 14,
      padding: 12,
      maxWidth: "88%",
    },
    facultyBubble: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderBottomLeftRadius: 2,
    },
    parentBubble: {
      alignSelf: "flex-end",
      borderBottomRightRadius: 2,
    },
    chatSenderName: {
      fontSize: 10.5,
      fontWeight: "800",
      marginBottom: 2,
    },
    chatMsgText: {
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: "500",
    },
    chatTimeText: {
      fontSize: 9.5,
      fontWeight: "500",
      alignSelf: "flex-end",
      marginTop: 4,
    },
    chatInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
      marginTop: 8,
    },
    chatInput: {
      flex: 1,
      fontSize: 12.5,
      maxHeight: 70,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
    },

    /* Helpdesk Card */
    helpdeskCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginTop: 8,
    },
    helpdeskTitle: {
      fontSize: 13.5,
      fontWeight: "800",
    },
    helpdeskSub: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
      marginBottom: 10,
    },
    helpdeskActionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    helpdeskBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    helpdeskBtnText: {
      fontSize: 11,
      fontWeight: "700",
    },

    /* Modal Styles */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      width: "100%",
      borderRadius: 22,
      borderWidth: 1,
      padding: 18,
      elevation: 12,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    modalCatText: {
      fontSize: 10.5,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    modalTitleText: {
      fontSize: 14.5,
      fontWeight: "800",
      marginTop: 2,
    },
    noticeMetaBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
      gap: 4,
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    metaKey: {
      fontSize: 11,
      fontWeight: "600",
    },
    metaVal: {
      fontSize: 11.5,
      fontWeight: "800",
    },
    modalBodyText: {
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: "500",
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    shareNoticeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    shareNoticeBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    closeModalBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    closeModalBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },
  });