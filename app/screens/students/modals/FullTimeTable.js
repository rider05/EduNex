import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  Share,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { showToast } from '../../../utils/toastService';
import { api } from '../../../services/api';

const DEPT_CODE_MAP = {
  'AI & DS': 'AI&DS',
  'CSE': 'CSE',
  'ECE': 'ECE',
  'MECH': 'MECH',
};

const DEPT_NAME_MAP = {
  'AI&DS': 'AI & DS',
  'CSE': 'CSE',
  'ECE': 'ECE',
  'MECH': 'MECH',
};

const FullTimetable = ({ visible = true, onClose, departmentCode: propDeptCode }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const days = [
    { short: 'Mon', full: 'Monday', label: 'Mon' },
    { short: 'Tue', full: 'Tuesday', label: 'Tue' },
    { short: 'Wed', full: 'Wednesday', label: 'Wed' },
    { short: 'Thu', full: 'Thursday', label: 'Thu' },
    { short: 'Fri', full: 'Friday', label: 'Fri' },
  ];

  const deptOptions = ['AI & DS', 'CSE', 'ECE', 'MECH'];
  const sessionTypes = ['All', 'Theory', 'Labs', 'Breaks'];

  const getCurrentDay = () => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const currentDayName = dayNames[today];
    if (currentDayName === 'Sunday' || currentDayName === 'Saturday') return 'Monday';
    return currentDayName;
  };

  const getTodayName = () => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[new Date().getDay()];
  };

  const [selectedDept, setSelectedDept] = useState('AI & DS');
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [selectedSessionType, setSelectedSessionType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [timetableData, setTimetableData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveDept() {
      if (propDeptCode) {
        const mapped = DEPT_NAME_MAP[propDeptCode];
        if (mapped) setSelectedDept(mapped);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const user = JSON.parse(raw);
          const dept = user?.department || user?.data?.department || '';
          const code = dept.replace(/^B\.Tech in\s*/i, '').trim();
          for (const [label, c] of Object.entries(DEPT_CODE_MAP)) {
            if (c === code || label.toLowerCase() === code.toLowerCase()) {
              setSelectedDept(label);
              return;
            }
          }
          if (DEPT_CODE_MAP[code]) setSelectedDept(DEPT_NAME_MAP[code] || 'AI & DS');
        }
      } catch {}
    }
    resolveDept();
  }, [propDeptCode]);

  const fetchTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/timetable');
      const docs = res?.data || [];
      const code = DEPT_CODE_MAP[selectedDept];
      const match = docs.find((d) => d.departmentCode === code);
      setTimetableData(match?.schedule || {});
    } catch (err) {
      console.warn('Timetable fetch error:', err);
      setTimetableData({});
    } finally {
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (visible) fetchTimetable();
  }, [visible, fetchTimetable]);

  const baseDaySchedule = useMemo(() => timetableData[selectedDay] || [], [timetableData, selectedDay]);

  const filteredSchedule = useMemo(() => {
    return baseDaySchedule.filter((item) => {
      if (selectedSessionType === 'Theory' && (item.type !== 'Theory' || item.isBreak)) return false;
      if (selectedSessionType === 'Labs' && (item.type !== 'Lab' || item.isBreak)) return false;
      if (selectedSessionType === 'Breaks' && !item.isBreak) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSubject = item.subject?.toLowerCase().includes(q);
        const matchesTeacher = item.teacher?.toLowerCase().includes(q);
        const matchesRoom = item.room?.toLowerCase().includes(q);
        const matchesCode = item.code?.toLowerCase().includes(q);
        if (!matchesSubject && !matchesTeacher && !matchesRoom && !matchesCode) return false;
      }
      return true;
    });
  }, [baseDaySchedule, selectedSessionType, searchQuery]);

  const totalLectures = baseDaySchedule.filter((i) => !i.isBreak && i.type === 'Theory').length;
  const totalLabs = baseDaySchedule.filter((i) => !i.isBreak && i.type === 'Lab').length;
  const totalBreaks = baseDaySchedule.filter((i) => i.isBreak).length;

  const handleClassClick = (item) => {
    if (!item.isBreak && item.teacherDetails) {
      setSelectedClass(item);
      setShowDetailsModal(true);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setTimeout(() => setSelectedClass(null), 300);
  };

  const handleShareSchedule = async () => {
    try {
      const classList = filteredSchedule
        .map(
          (c) =>
            `• [${c.time}] ${c.period ? `${c.period}: ` : ''}${c.subject} (${
              c.isBreak ? 'Break' : `${c.room} · ${c.teacher || 'Faculty'}`
            })`
        )
        .join('\n');

      await Share.share({
        title: `EduNex Timetable - ${selectedDay} (${selectedDept})`,
        message: `EduNex Autonomous Campus Timetable\nDepartment: ${selectedDept}\nDay: ${selectedDay}\n\nSchedule:\n${classList}\n\nGenerated via EduNex Smart Campus App.`,
      });
      showToast(`Shared ${selectedDay}'s schedule!`, 'success');
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const handleExportPDF = () => {
    showToast(`Exporting ${selectedDept} ${selectedDay} Schedule as PDF...`, 'success');
  };

  const handleContactFaculty = (type, value) => {
    if (type === 'email') {
      Linking.openURL(`mailto:${value}`).catch(() => {
        showToast(`Email: ${value}`, 'info');
      });
    } else if (type === 'phone') {
      Linking.openURL(`tel:${value.replace(/\s+/g, '')}`).catch(() => {
        showToast(`Phone: ${value}`, 'info');
      });
    }
  };

  const handleBookConsultation = () => {
    showToast(`Consultation request sent to ${selectedClass?.teacher}!`, 'success');
    closeDetailsModal();
  };

  const renderClassCard = (item, index) => {
    const isBreak = item.isBreak;

    if (isBreak) {
      return (
        <View
          key={index}
          style={[
            styles.breakCardWrapper,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <View style={styles.breakIconWrap}>
            <Icon
              name={item.subject.toLowerCase().includes('lunch') ? 'food-fork-drink' : 'coffee-outline'}
              size={22}
              color="#F59E0B"
            />
          </View>
          <View style={styles.breakContent}>
            <View style={styles.breakHeaderRow}>
              <Text style={[styles.breakTitle, { color: colors.primaryText }]}>{item.subject}</Text>
              <View style={styles.breakDurationBadge}>
                <Text style={styles.breakDurationText}>{item.duration}</Text>
              </View>
            </View>
            <View style={styles.breakMetaRow}>
              <Icon name="clock-outline" size={13} color={colors.secondaryText} />
              <Text style={[styles.breakMetaText, { color: colors.secondaryText }]}>{item.time}</Text>
              <Text style={[styles.breakDot, { color: colors.secondaryText }]}>•</Text>
              <Icon name="map-marker-outline" size={13} color={colors.secondaryText} />
              <Text style={[styles.breakMetaText, { color: colors.secondaryText }]}>{item.room}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.lectureCardWrapper,
          { backgroundColor: colors.cardBackground, borderColor: colors.divider },
        ]}
        activeOpacity={0.85}
        onPress={() => handleClassClick(item)}
      >
        <View style={[styles.lectureColorStrip, { backgroundColor: item.color || colors.primaryAccent }]} />

        <View style={styles.lectureCardBody}>
          <View style={styles.lectureTopRow}>
            <View style={styles.periodTimeGroup}>
              <View style={[styles.periodBadge, { backgroundColor: (item.color || colors.primaryAccent) + '18' }]}>
                <Text style={[styles.periodBadgeText, { color: item.color || colors.primaryAccent }]}>
                  {item.period || ''}
                </Text>
              </View>
              <Text style={[styles.lectureTimeText, { color: colors.primaryText }]}>{item.time}</Text>
              <Text style={[styles.lectureDurationText, { color: colors.secondaryText }]}>({item.duration})</Text>
            </View>

            <View style={styles.typeBadgeGroup}>
              {item.code && (
                <View style={[styles.codeBadge, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Text style={[styles.codeBadgeText, { color: colors.secondaryText }]}>{item.code}</Text>
                </View>
              )}
              <View
                style={[
                  styles.typeBadge,
                  {
                    backgroundColor:
                      item.type === 'Lab' ? '#7C3AED18' : (item.color || colors.primaryAccent) + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    {
                      color:
                        item.type === 'Lab' ? '#7C3AED' : item.color || colors.primaryAccent,
                    },
                  ]}
                >
                  {item.type === 'Lab' ? 'Practical Lab' : 'Lecture'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.subjectTitle, { color: colors.primaryText }]}>{item.subject}</Text>

          <View style={styles.lectureBottomRow}>
            <View style={styles.facultyRow}>
              <View style={[styles.facultyAvatarSmall, { backgroundColor: (item.color || colors.primaryAccent) + '22' }]}>
                <Icon name="account" size={14} color={item.color || colors.primaryAccent} />
              </View>
              <Text style={[styles.facultyNameText, { color: colors.secondaryText }]} numberOfLines={1}>
                {item.teacher || 'Faculty Assigned'}
              </Text>
            </View>

            <View style={styles.rightInfoRow}>
              {item.room && (
                <View style={[styles.roomPill, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                  <Icon name="map-marker-outline" size={12} color={colors.primaryAccent} />
                  <Text style={[styles.roomPillText, { color: colors.primaryText }]}>{item.room}</Text>
                </View>
              )}
              <Icon name="chevron-right" size={18} color={colors.disabledText} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const mainView = (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle || 'dark-content'} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color={colors.primaryText} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>Academic Timetable</Text>
              <View style={styles.liveTermBadge}>
                <Text style={styles.liveTermBadgeText}>{"Odd '25"}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {selectedDept}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.primaryBackground }]}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <Icon name="file-pdf-box" size={20} color="#EF4444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: colors.primaryBackground }]}
            onPress={handleShareSchedule}
            activeOpacity={0.8}
          >
            <Icon name="share-variant-outline" size={20} color={colors.primaryAccent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.deptSelectorStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deptScrollContent}
        >
          {deptOptions.map((dept) => {
            const isSel = selectedDept === dept;
            return (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.deptPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent, borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
                onPress={() => setSelectedDept(dept)}
                activeOpacity={0.8}
              >
                <Text style={[styles.deptPillText, { color: isSel ? '#FFFFFF' : colors.primaryText }]}>
                  {dept}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.daySelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelectorContent}
        >
          {days.map((day) => {
            const isSelected = selectedDay === day.full;
            const isToday = getTodayName() === day.full;

            return (
              <TouchableOpacity
                key={day.full}
                style={[
                  styles.dayCard,
                  { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  isSelected && [styles.dayCardActive, { borderColor: colors.primaryAccent }],
                ]}
                onPress={() => setSelectedDay(day.full)}
                activeOpacity={0.8}
              >
                {isToday && (
                  <View style={styles.todayIndicatorPill}>
                    <View style={styles.todayDot} />
                    <Text style={styles.todayText}>Today</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.dayShortText,
                    { color: isSelected ? colors.primaryAccent : colors.secondaryText },
                  ]}
                >
                  {day.short}
                </Text>
                <Text
                  style={[
                    styles.dayFullText,
                    { color: isSelected ? colors.primaryText : colors.disabledText },
                  ]}
                >
                  {day.full.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.metricsBanner}>
        <View style={[styles.metricsBannerCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: colors.primaryAccent }]}>{filteredSchedule.length}</Text>
            <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Total Sessions</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#2563EB' }]}>{totalLectures}</Text>
            <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Theory Classes</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#7C3AED' }]}>{totalLabs}</Text>
            <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Lab Practicals</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{totalBreaks}</Text>
            <Text style={[styles.metricLbl, { color: colors.secondaryText }]}>Recess / Break</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterSection}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <Icon name="magnify" size={18} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Search subject, faculty, or room..."
            placeholderTextColor={colors.disabledText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sessionTypeScroll}
        >
          {sessionTypes.map((type) => {
            const isSel = selectedSessionType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.sessionPill,
                  isSel
                    ? { backgroundColor: colors.primaryAccent + '20', borderColor: colors.primaryAccent }
                    : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                ]}
                onPress={() => setSelectedSessionType(type)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.sessionPillText,
                    { color: isSel ? colors.primaryAccent : colors.secondaryText },
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primaryAccent} />
          <Text style={[styles.emptyScheduleSub, { color: colors.secondaryText, marginTop: 12 }]}>Loading timetable...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scheduleList}
          contentContainerStyle={styles.scheduleListContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredSchedule.length > 0 ? (
            filteredSchedule.map((item, index) => renderClassCard(item, index))
          ) : (
            <View style={[styles.emptyScheduleBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Icon name="calendar-remove-outline" size={48} color={colors.disabledText} />
              <Text style={[styles.emptyScheduleTitle, { color: colors.primaryText }]}>No Classes Scheduled</Text>
              <Text style={[styles.emptyScheduleSub, { color: colors.secondaryText }]}>
                {searchQuery
                  ? `No results match "${searchQuery}" on ${selectedDay}.`
                  : `Enjoy your free time or utilize the campus library!`}
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showDetailsModal} transparent animationType="slide" onRequestClose={closeDetailsModal}>
        <TouchableWithoutFeedback onPress={closeDetailsModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { backgroundColor: colors.cardBackground }]}>
                {selectedClass && (
                  <>
                    <View style={styles.sheetHandle} />

                    <View style={styles.sheetHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <View
                            style={[
                              styles.modalCodeBadge,
                              { backgroundColor: (selectedClass.color || colors.primaryAccent) + '20' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalCodeBadgeText,
                                { color: selectedClass.color || colors.primaryAccent },
                              ]}
                            >
                              {selectedClass.code || 'COURSE'}
                            </Text>
                          </View>
                          <Text style={[styles.modalCreditsText, { color: colors.secondaryText }]}>
                            {selectedClass.credits || '3 Credits'}
                          </Text>
                        </View>
                        <Text style={[styles.modalSubjectTitle, { color: colors.primaryText }]}>
                          {selectedClass.subject}
                        </Text>
                      </View>

                      <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeDetailsModal}>
                        <Icon name="close" size={20} color={colors.primaryText} />
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                      <View style={[styles.facultyDetailCard, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                        <View style={[styles.facultyBigAvatar, { backgroundColor: (selectedClass.color || colors.primaryAccent) + '25' }]}>
                          <Icon name="account-tie" size={32} color={selectedClass.color || colors.primaryAccent} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.facultyBigName, { color: colors.primaryText }]}>
                            {selectedClass.teacher}
                          </Text>
                          <Text style={[styles.facultyBigDesignation, { color: selectedClass.color || colors.primaryAccent }]}>
                            {selectedClass.teacherDetails?.designation || 'Faculty Member'}
                          </Text>
                          <Text style={[styles.facultyBigDept, { color: colors.secondaryText }]}>
                            Dept of {selectedClass.teacherDetails?.department} · {selectedClass.teacherDetails?.experience}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.specsGrid}>
                        <View style={[styles.specBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="clock-outline" size={18} color={colors.primaryAccent} />
                          <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Timing</Text>
                            <Text style={[styles.specVal, { color: colors.primaryText }]}>
                              {selectedClass.time} ({selectedClass.duration})
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.specBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="door-open" size={18} color="#2563EB" />
                          <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Classroom</Text>
                            <Text style={[styles.specVal, { color: colors.primaryText }]}>{selectedClass.room}</Text>
                          </View>
                        </View>

                        <View style={[styles.specBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="office-building" size={18} color="#7C3AED" />
                          <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Office Cabin</Text>
                            <Text style={[styles.specVal, { color: colors.primaryText }]}>
                              {selectedClass.teacherDetails?.cabin || 'Staff Room'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.specBox, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}>
                          <Icon name="school-outline" size={18} color="#059669" />
                          <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={[styles.specLabel, { color: colors.secondaryText }]}>Qualification</Text>
                            <Text style={[styles.specVal, { color: colors.primaryText }]} numberOfLines={1}>
                              {selectedClass.teacherDetails?.qualification || 'M.E., Ph.D'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={[styles.commSectionTitle, { color: colors.primaryText }]}>Direct Assistance</Text>

                      <View style={styles.contactActionsRow}>
                        <TouchableOpacity
                          style={[styles.contactActionBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => handleContactFaculty('email', selectedClass.teacherDetails?.email)}
                          activeOpacity={0.7}
                        >
                          <Icon name="email-outline" size={20} color="#2563EB" />
                          <Text style={[styles.contactActionText, { color: colors.primaryText }]}>Email Professor</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.contactActionBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.divider }]}
                          onPress={() => handleContactFaculty('phone', selectedClass.teacherDetails?.phone)}
                          activeOpacity={0.7}
                        >
                          <Icon name="phone-outline" size={20} color="#059669" />
                          <Text style={[styles.contactActionText, { color: colors.primaryText }]}>Call Cabin</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.bookConsultBtn, { backgroundColor: colors.primaryAccent }]}
                        onPress={handleBookConsultation}
                        activeOpacity={0.8}
                      >
                        <Icon name="calendar-clock" size={18} color="#FFFFFF" />
                        <Text style={styles.bookConsultBtnText}>Request 1-on-1 Academic Consultation</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );

  if (visible === false) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {mainView}
    </Modal>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 14,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    closeButton: {
      padding: 6,
      borderRadius: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primaryText,
      letterSpacing: -0.3,
    },
    liveTermBadge: {
      backgroundColor: '#10B98118',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    liveTermBadgeText: {
      color: '#10B981',
      fontSize: 10,
      fontWeight: '800',
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.secondaryText,
      fontWeight: '600',
      marginTop: 2,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerActionBtn: {
      padding: 8,
      borderRadius: 10,
    },
    deptSelectorStrip: {
      paddingVertical: 8,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    deptScrollContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    deptPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    deptPillText: {
      fontSize: 12,
      fontWeight: '800',
    },
    daySelectorContainer: {
      paddingVertical: 12,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    daySelectorContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    dayCard: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      alignItems: 'center',
      minWidth: 64,
      borderWidth: 1,
    },
    dayCardActive: {
      borderWidth: 2,
      elevation: 2,
    },
    todayIndicatorPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 3,
    },
    todayDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#10B981',
    },
    todayText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#10B981',
      textTransform: 'uppercase',
    },
    dayShortText: {
      fontSize: 14,
      fontWeight: '800',
    },
    dayFullText: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 1,
    },
    metricsBanner: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
    },
    metricsBannerCard: {
      flexDirection: 'row',
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metricItem: {
      flex: 1,
      alignItems: 'center',
    },
    metricVal: {
      fontSize: 16,
      fontWeight: '900',
    },
    metricLbl: {
      fontSize: 9.5,
      fontWeight: '600',
      marginTop: 2,
    },
    metricDivider: {
      width: 1,
      height: '60%',
    },
    filterSection: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
      gap: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      padding: 0,
      fontWeight: '600',
    },
    sessionTypeScroll: {
      gap: 6,
    },
    sessionPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1,
    },
    sessionPillText: {
      fontSize: 11.5,
      fontWeight: '700',
    },
    scheduleList: {
      flex: 1,
    },
    scheduleListContent: {
      paddingHorizontal: 16,
      paddingTop: 6,
      gap: 10,
    },
    lectureCardWrapper: {
      flexDirection: 'row',
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      elevation: 2,
    },
    lectureColorStrip: {
      width: 5,
    },
    lectureCardBody: {
      flex: 1,
      padding: 12,
      gap: 6,
    },
    lectureTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    periodTimeGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    periodBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    periodBadgeText: {
      fontSize: 10,
      fontWeight: '900',
    },
    lectureTimeText: {
      fontSize: 13,
      fontWeight: '800',
    },
    lectureDurationText: {
      fontSize: 11,
      fontWeight: '500',
    },
    typeBadgeGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    codeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: 1,
    },
    codeBadgeText: {
      fontSize: 9.5,
      fontWeight: '700',
    },
    typeBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    subjectTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      lineHeight: 19,
      marginTop: 2,
    },
    lectureBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    facultyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    facultyAvatarSmall: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    facultyNameText: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    rightInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    roomPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    roomPillText: {
      fontSize: 10.5,
      fontWeight: '700',
    },
    breakCardWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      gap: 12,
      borderStyle: 'dashed',
    },
    breakIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#F59E0B18',
      justifyContent: 'center',
      alignItems: 'center',
    },
    breakContent: {
      flex: 1,
      gap: 3,
    },
    breakHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    breakTitle: {
      fontSize: 13.5,
      fontWeight: '800',
    },
    breakDurationBadge: {
      backgroundColor: '#F59E0B20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    breakDurationText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#D97706',
    },
    breakMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    breakMetaText: {
      fontSize: 11,
      fontWeight: '500',
    },
    breakDot: {
      fontSize: 11,
    },
    emptyScheduleBox: {
      paddingVertical: 36,
      paddingHorizontal: 20,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      gap: 8,
    },
    emptyScheduleTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginTop: 4,
    },
    emptyScheduleSub: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 17,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 30,
      elevation: 20,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#94A3B8',
      alignSelf: 'center',
      marginBottom: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    modalCodeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
    },
    modalCodeBadgeText: {
      fontSize: 10.5,
      fontWeight: '900',
    },
    modalCreditsText: {
      fontSize: 11,
      fontWeight: '600',
    },
    modalSubjectTitle: {
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    sheetCloseBtn: {
      padding: 6,
      borderRadius: 12,
    },
    facultyDetailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      marginBottom: 14,
    },
    facultyBigAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    facultyBigName: {
      fontSize: 15,
      fontWeight: '800',
    },
    facultyBigDesignation: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 1,
    },
    facultyBigDept: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 2,
    },
    specsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 14,
    },
    specBox: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      padding: 10,
    },
    specLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    specVal: {
      fontSize: 12,
      fontWeight: '800',
      marginTop: 1,
    },
    commSectionTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 8,
    },
    contactActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    contactActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    contactActionText: {
      fontSize: 12,
      fontWeight: '700',
    },
    bookConsultBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 4,
    },
    bookConsultBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
  });

export default FullTimetable;
