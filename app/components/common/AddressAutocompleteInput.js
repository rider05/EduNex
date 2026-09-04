import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../context/ThemeContext";

// Curated high-frequency addresses & locations (instant 0ms response)
const CURATED_ADDRESSES = [
  { main: "15, Gandhipuram", sub: "Coimbatore, Tamil Nadu 641012", full: "15, Gandhipuram, Coimbatore, Tamil Nadu 641012" },
  { main: "RS Puram West", sub: "Coimbatore, Tamil Nadu 641002", full: "D.No 42, DB Road, RS Puram, Coimbatore, Tamil Nadu 641002" },
  { main: "Peelamedu", sub: "Avinashi Road, Coimbatore, Tamil Nadu 641004", full: "Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu 641004" },
  { main: "Saravanampatti", sub: "Sathy Road, Coimbatore, Tamil Nadu 641035", full: "Sathy Main Road, Saravanampatti, Coimbatore, Tamil Nadu 641035" },
  { main: "Saibaba Colony", sub: "NSR Road, Coimbatore, Tamil Nadu 641011", full: "NSR Road, Saibaba Colony, Coimbatore, Tamil Nadu 641011" },
  { main: "Singanallur", sub: "Trichy Road, Coimbatore, Tamil Nadu 641005", full: "Trichy Road, Singanallur, Coimbatore, Tamil Nadu 641005" },
  { main: "Vadavalli", sub: "Marudhamalai Road, Coimbatore, Tamil Nadu 641041", full: "Marudhamalai Main Road, Vadavalli, Coimbatore, Tamil Nadu 641041" },
  { main: "Thudiyalur", sub: "Mettupalayam Road, Coimbatore, Tamil Nadu 641034", full: "Mettupalayam Road, Thudiyalur, Coimbatore, Tamil Nadu 641034" },
  { main: "Ukkadam", sub: "Coimbatore, Tamil Nadu 641001", full: "Oppanakara Street, Ukkadam, Coimbatore, Tamil Nadu 641001" },
  { main: "Kuniyamuthur", sub: "Palakkad Main Road, Coimbatore, Tamil Nadu 641008", full: "Palakkad Main Road, Kuniyamuthur, Coimbatore, Tamil Nadu 641008" },
  { main: "Kovaipudur", sub: "Coimbatore, Tamil Nadu 641042", full: "Kovaipudur Main Road, Coimbatore, Tamil Nadu 641042" },
  { main: "SITRA & Airport Area", sub: "Civil Aerodrome Post, Coimbatore, Tamil Nadu 641014", full: "Avinashi Road, SITRA, Civil Aerodrome Post, Coimbatore, Tamil Nadu 641014" },
  { main: "Hope College", sub: "Peelamedu, Coimbatore, Tamil Nadu 641004", full: "Hope College, Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu 641004" },
  { main: "Ganapathy", sub: "Sathy Road, Coimbatore, Tamil Nadu 641006", full: "Athipalayam Road, Ganapathy, Coimbatore, Tamil Nadu 641006" },
  { main: "Ramanathapuram", sub: "Trichy Road, Coimbatore, Tamil Nadu 641045", full: "Trichy Road, Ramanathapuram, Coimbatore, Tamil Nadu 641045" },
  { main: "Sulur", sub: "Coimbatore District, Tamil Nadu 641402", full: "Ranganathan Nagar, Sulur, Coimbatore, Tamil Nadu 641402" },
  { main: "Pollachi", sub: "Coimbatore District, Tamil Nadu 642001", full: "New Scheme Road, Pollachi, Coimbatore, Tamil Nadu 642001" },
  { main: "Mettupalayam", sub: "Coimbatore District, Tamil Nadu 641301", full: "Kotagiri Road, Mettupalayam, Coimbatore, Tamil Nadu 641301" },
  { main: "Perur", sub: "Siruvani Main Road, Coimbatore, Tamil Nadu 641010", full: "Siruvani Main Road, Perur, Coimbatore, Tamil Nadu 641010" },
  { main: "T. Nagar", sub: "Chennai, Tamil Nadu 600017", full: "Usman Road, T. Nagar, Chennai, Tamil Nadu 600017" },
  { main: "Anna Nagar", sub: "Chennai, Tamil Nadu 600040", full: "2nd Avenue, Anna Nagar, Chennai, Tamil Nadu 600040" },
  { main: "Adyar", sub: "Chennai, Tamil Nadu 600020", full: "LB Road, Adyar, Chennai, Tamil Nadu 600020" },
  { main: "Velachery", sub: "Chennai, Tamil Nadu 600042", full: "Velachery Bypass Road, Chennai, Tamil Nadu 600042" },
  { main: "Tambaram", sub: "Chennai, Tamil Nadu 600045", full: "GST Road, Tambaram, Chennai, Tamil Nadu 600045" },
  { main: "KK Nagar", sub: "Madurai, Tamil Nadu 625020", full: "80 Feet Road, KK Nagar, Madurai, Tamil Nadu 625020" },
  { main: "Goripalayam", sub: "Madurai, Tamil Nadu 625002", full: "Albert Victor Bridge Road, Goripalayam, Madurai, Tamil Nadu 625002" },
  { main: "Fairlands", sub: "Salem, Tamil Nadu 636016", full: "Brindavan Road, Fairlands, Salem, Tamil Nadu 636016" },
  { main: "Perundurai Road", sub: "Erode, Tamil Nadu 638011", full: "Perundurai Road, Erode, Tamil Nadu 638011" },
  { main: "Avinashi Main Road", sub: "Tiruppur, Tamil Nadu 641602", full: "Avinashi Main Road, Pushpa Theatre Area, Tiruppur, Tamil Nadu 641602" },
  { main: "Thillai Nagar", sub: "Tiruchirappalli, Tamil Nadu 620018", full: "11th Cross, Thillai Nagar, Tiruchirappalli, Tamil Nadu 620018" },
  { main: "Koramangala", sub: "Bengaluru, Karnataka 560034", full: "80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034" },
  { main: "Indiranagar", sub: "Bengaluru, Karnataka 560038", full: "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038" },
  { main: "HSR Layout", sub: "Bengaluru, Karnataka 560102", full: "Sector 2, HSR Layout, Bengaluru, Karnataka 560102" },
  { main: "Whitefield", sub: "Bengaluru, Karnataka 560066", full: "ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066" },
  { main: "Campus Quarters", sub: "EduNex Staff Quarters, Coimbatore 641014", full: "Faculty Block B, Staff Quarters, EduNex Campus, Coimbatore 641014" },
];

export default function AddressAutocompleteInput({
  value = "",
  onChangeText = () => {},
  placeholder = "Start typing street, area, city or pincode...",
  editable = true,
  style = {},
  inputStyle = {},
}) {
  const { colors, isDarkMode } = useTheme();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const handleTextChange = (text) => {
    setQuery(text);
    onChangeText(text);

    if (!text.trim() || text.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // 1. Instant local matching
    const qLower = text.toLowerCase().trim();
    const localMatches = CURATED_ADDRESSES.filter(
      (a) =>
        a.full.toLowerCase().includes(qLower) ||
        a.main.toLowerCase().includes(qLower) ||
        a.sub.toLowerCase().includes(qLower)
    );

    setSuggestions(localMatches);
    setIsOpen(localMatches.length > 0);

    // 2. Debounced online Nominatim query for any custom location in India
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          text.trim()
        )}&countrycodes=in&addressdetails=1&limit=5`;
        const res = await fetch(url, {
          headers: { "User-Agent": "EduNexApp/1.0 (academic-management)" },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const onlineResults = data.map((item) => {
              const display = item.display_name || "";
              const parts = display.split(", ");
              const mainName = parts.slice(0, 2).join(", ");
              const subName = parts.slice(2, 6).join(", ");
              return {
                main: mainName || item.name || display,
                sub: subName || "India",
                full: display,
              };
            });

            // Combine unique items
            const seen = new Set(localMatches.map((m) => m.full.toLowerCase()));
            const merged = [...localMatches];
            for (const o of onlineResults) {
              if (!seen.has(o.full.toLowerCase())) {
                seen.add(o.full.toLowerCase());
                merged.push(o);
              }
            }
            setSuggestions(merged);
            setIsOpen(merged.length > 0);
          }
        }
      } catch {
        // Fall back to local results
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (item) => {
    setQuery(item.full);
    onChangeText(item.full);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    setQuery("");
    onChangeText("");
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.primaryBackground,
            borderColor: isOpen ? colors.primaryAccent : colors.divider,
          },
        ]}
      >
        <Icon
          name="map-marker-outline"
          size={20}
          color={isOpen ? colors.primaryAccent : colors.secondaryText}
          style={styles.leadingIcon}
        />
        <TextInput
          style={[styles.input, { color: colors.primaryText }, inputStyle]}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.disabledText || colors.secondaryText}
          editable={editable}
          multiline
          numberOfLines={2}
          onFocus={() => {
            if (query.trim().length >= 2 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
        />

        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryAccent} style={{ marginRight: 6 }} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.clearBtn}>
            <Icon name="close-circle" size={18} color={colors.secondaryText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dropdown Suggestions List */}
      {isOpen && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.divider,
              shadowColor: isDarkMode ? "#000000" : "#4F46E5",
            },
          ]}
        >
          <View style={[styles.dropdownHeader, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name="map-search-outline" size={13} color={colors.primaryAccent} />
              <Text style={[styles.dropdownHeaderText, { color: colors.secondaryText }]}>
                Matching Addresses ({suggestions.length})
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 11, color: colors.primaryAccent, fontWeight: "700" }}>Close ✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item.full}-${index}`}
                style={[
                  styles.itemRow,
                  {
                    borderBottomColor: colors.divider,
                    backgroundColor: index % 2 === 0 ? "transparent" : colors.primaryBackground + "50",
                  },
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.pinCircle, { backgroundColor: colors.primaryAccent + "14" }]}>
                  <Icon name="map-marker" size={15} color={colors.primaryAccent} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.mainText, { color: colors.primaryText }]} numberOfLines={1}>
                    {item.main}
                  </Text>
                  <Text style={[styles.subText, { color: colors.secondaryText }]} numberOfLines={2}>
                    {item.sub}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.secondaryText} style={{ opacity: 0.5 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
  },
  leadingIcon: {
    marginTop: 6,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    minHeight: 40,
    textAlignVertical: "top",
    paddingTop: 4,
    paddingBottom: 4,
  },
  clearBtn: {
    marginTop: 6,
    marginLeft: 4,
  },
  dropdown: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 6,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    maxHeight: 220,
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listScroll: {
    maxHeight: 180,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  itemContent: {
    flex: 1,
  },
  mainText: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 1.5,
  },
  subText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
