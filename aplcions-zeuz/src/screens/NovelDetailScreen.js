import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Image } from 'expo-image'; 
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { incrementView } from '../services/api'; 
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const { width, height } = Dimensions.get('window');

// Format views helper
const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

const getStatusColor = (status) => {
    switch (status) {
        case 'مكتملة': return '#27ae60';
        case 'متوقفة': return '#c0392b';
        default: return '#8e44ad';
    }
};

export default function NovelDetailScreen({ route, navigation }) {
  const { userInfo } = useContext(AuthContext);
  const { showToast } = useToast();
  
  const initialNovelData = route.params.novel || {};
  
  const [fullNovel, setFullNovel] = useState(initialNovelData);
  const [authorProfile, setAuthorProfile] = useState(null); // State for author details
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('about');
  const [isFavorite, setIsFavorite] = useState(false);
  const [lastReadChapterId, setLastReadChapterId] = useState(0); 
  const [maxReadChapterId, setMaxReadChapterId] = useState(0); 

  const scrollY = useRef(new Animated.Value(0)).current;

  const novelId = fullNovel._id || fullNovel.id || fullNovel.novelId;

  // Check ownership: Admin OR Email Match OR (Legacy) Name Match
  const isOwner = userInfo && (
      userInfo.role === 'admin' || 
      (fullNovel.authorEmail && fullNovel.authorEmail === userInfo.email) ||
      (!fullNovel.authorEmail && fullNovel.author && fullNovel.author.toLowerCase() === userInfo.name.toLowerCase())
  );

  const fetchDetails = async () => {
    setLoading(true);
    setError(false);
    try {
      if (!novelId) throw new Error("Novel ID not found");

      const response = await api.get(`/api/novels/${novelId}`);
      const novelData = response.data;
      setFullNovel(prev => ({ ...prev, ...novelData }));
      setChapters(novelData.chapters || []);

      // Fetch Author Profile Data
      let query = '';
      if (novelData.authorEmail) {
          query = `email=${novelData.authorEmail}`;
      } else if (novelData.author) {
          // Legacy support fallback
      }

      if (query) {
          try {
              const authorRes = await api.get(`/api/user/stats?${query}`);
              setAuthorProfile(authorRes.data.user);
          } catch (e) { console.log("Failed to fetch author profile"); }
      }

      try {
        const statusRes = await api.get(`/api/novel/status/${novelId}`);
        if (statusRes.data) {
          setIsFavorite(statusRes.data.isFavorite);
          setLastReadChapterId(statusRes.data.lastChapterId || 0);
          setMaxReadChapterId(statusRes.data.maxReadChapterId || statusRes.data.lastChapterId || 0);
        }
      } catch (e) {
         console.log("Status check failed, ignoring");
      }
    } catch (e) {
      console.error('Error fetching novel details', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDetails();
    }, [novelId])
  );

  const handleDeleteChapter = (chapNum) => {
    Alert.alert(
        "حذف الفصل",
        "هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.",
        [
            { text: "إلغاء", style: "cancel" },
            { 
                text: "حذف", 
                style: "destructive", 
                onPress: async () => {
                    try {
                        await api.delete(`/api/admin/chapters/${novelId}/${chapNum}`);
                        showToast("تم حذف الفصل بنجاح", "success");
                        fetchDetails();
                    } catch (e) {
                        showToast("فشل الحذف", "error");
                    }
                }
            }
        ]
    );
  };

  const handleEditChapter = (chapter) => {
      // Navigate to Dashboard with specific chapter edit params
      navigation.navigate('AdminDashboard', { 
          editNovel: fullNovel, // Context for the dashboard
          editChapter: { 
              novelId: novelId,
              number: chapter.number,
              title: chapter.title
          }
      });
  };

  const handleEditNovel = () => {
      navigation.navigate('AdminDashboard', { editNovel: fullNovel });
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  const toggleLibrary = async () => {
    try {
      const newStatus = !isFavorite;
      setIsFavorite(newStatus);
      
      setFullNovel(prev => ({
          ...prev,
          favorites: (prev.favorites || 0) + (newStatus ? 1 : -1)
      }));

      await api.post('/api/novel/update', {
        novelId: novelId,
        title: fullNovel.title,
        cover: fullNovel.cover,
        author: fullNovel.author,
        isFavorite: newStatus
      });
      
      if (newStatus) showToast("تمت الإضافة للمفضلة");
      else showToast("تم الحذف من المفضلة", "info");

    } catch (error) {
      setIsFavorite(!isFavorite); // Revert
      showToast("فشلت العملية", "error");
    }
  };

  const renderTabButton = (id, title) => (
    <TouchableOpacity 
      style={[styles.tabButton, activeTab === id && styles.tabButtonActive]}
      onPress={() => setActiveTab(id)}
    >
      <Text style={[styles.tabText, activeTab === id && styles.tabTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderChapterItem = ({ item }) => {
    const isRead = item.number <= maxReadChapterId;
    return (
        <View style={styles.chapterRowContainer}>
             {isOwner && (
                 <View style={styles.adminControls}>
                     <TouchableOpacity style={styles.adminBtn} onPress={() => handleEditChapter(item)}>
                         <Ionicons name="create-outline" size={18} color="#4a7cc7" />
                     </TouchableOpacity>
                     <TouchableOpacity style={styles.adminBtn} onPress={() => handleDeleteChapter(item.number)}>
                         <Ionicons name="trash-outline" size={18} color="#ff4444" />
                     </TouchableOpacity>
                 </View>
             )}
            <TouchableOpacity 
              style={[styles.chapterItem, isRead && styles.chapterItemRead, isOwner && {flex: 1}]}
              onPress={() => {
                incrementView(novelId, item.number);
                navigation.navigate('Reader', { novel: fullNovel, chapterId: item.number });
              }}
            >
              <View style={styles.chapterLeft}>
                 {isRead ? (
                    <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                 ) : (
                    <Ionicons name="ellipse-outline" size={18} color="#666" />
                 )}
              </View>
              <View style={styles.chapterContent}>
                <Text style={[styles.chapterTitle, isRead && styles.textRead]}>{item.title}</Text>
                <Text style={styles.chapterDate}>فصل رقم {item.number}</Text>
              </View>
            </TouchableOpacity>
        </View>
    );
  };

  // Redesigned Author Widget (Full Width Banner Style)
  const AuthorWidget = () => {
      const displayName = authorProfile?.name || fullNovel.author || 'غير معروف';
      const displayAvatar = authorProfile?.picture;
      const displayBanner = authorProfile?.banner;
      
      const targetId = authorProfile?._id;

      return (
          <View style={styles.authorSection}>
              <Text style={styles.sectionTitle}>الناشر</Text>
              
              <TouchableOpacity 
                style={styles.authorCardContainer}
                activeOpacity={0.9}
                onPress={() => {
                    if (targetId) {
                        navigation.push('UserProfile', { userId: targetId });
                    } else {
                        showToast("هذا الناشر ليس لديه ملف شخصي عام", "info");
                    }
                }}
              >
                  <View style={styles.authorBannerWrapper}>
                    {/* Back to "cover" for full-filled aesthetic */}
                    {displayBanner ? (
                        <Image 
                            source={{ uri: displayBanner }} 
                            style={styles.authorBannerImage} 
                            contentFit="cover" 
                        />
                    ) : (
                        <View style={[styles.authorBannerImage, {backgroundColor: '#222'}]} /> 
                    )}
                    
                    <LinearGradient 
                        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']} 
                        style={StyleSheet.absoluteFill} 
                    />
                    
                    <View style={styles.authorOverlayContent}>
                        <View style={styles.authorAvatarWrapper}>
                            <Image 
                                source={displayAvatar ? { uri: displayAvatar } : require('../../assets/adaptive-icon.png')} 
                                style={styles.authorAvatarImage}
                                contentFit="cover"
                            />
                        </View>
                        <Text style={styles.authorDisplayName} numberOfLines={1}>{displayName}</Text>
                    </View>
                  </View>
              </TouchableOpacity>
          </View>
      );
  };

  if (!fullNovel || (!fullNovel.title && loading)) {
      return (
          <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
              <ActivityIndicator size="large" color="#4a7cc7" />
          </View>
      )
  }

  // Tags Logic
  const allTags = [
    ...(fullNovel.category ? [fullNovel.category] : []),
    ...(fullNovel.tags || [])
  ];
  const uniqueTags = [...new Set(allTags)];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={styles.headerTitle} numberOfLines={1}>{fullNovel.title}</Text>
        </SafeAreaView>
      </Animated.View>

      <SafeAreaView edges={['top']} style={styles.floatingControls}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        {/* Only Owner/Admin can edit */}
        {isOwner && (
            <TouchableOpacity style={[styles.iconButton, {backgroundColor: '#4a7cc7'}]} onPress={handleEditNovel}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
        )}
      </SafeAreaView>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <Animated.View style={[styles.coverContainer, { transform: [{ scale: imageScale }] }]}>
          <Image 
            source={fullNovel.cover} 
            style={styles.coverImage} 
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk" 
          />
          <LinearGradient colors={['transparent', '#000000']} style={styles.coverGradient} />
        </Animated.View>

        <View style={styles.contentContainer}>
          <View style={styles.statusBadgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(fullNovel.status) }]}>
                <Text style={styles.statusText}>{fullNovel.status || 'مستمرة'}</Text>
            </View>
          </View>

          <Text style={styles.title}>{fullNovel.title}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{chapters.length || fullNovel.chaptersCount || 0}</Text>
              <Text style={styles.statLabel}>فصل</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(fullNovel.views)}</Text>
              <Text style={styles.statLabel}>مشاهدة</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: '#ffa500'}]}>{formatNumber(fullNovel.favorites || 0)}</Text>
              <Text style={styles.statLabel}>مفضلة</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.libraryButton, isFavorite && styles.libraryButtonActive]} 
              onPress={toggleLibrary}
            >
              <Ionicons name={isFavorite ? "checkmark" : "add"} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.readButton}
              onPress={() => {
                if (chapters.length === 0) {
                    showToast("لا توجد فصول متاحة حالياً", "info");
                    return;
                }
                const targetChapterNum = lastReadChapterId > 0 && lastReadChapterId < chapters.length 
                    ? lastReadChapterId + 1 
                    : (lastReadChapterId === chapters.length ? lastReadChapterId : 1);
                
                incrementView(novelId, targetChapterNum);
                navigation.navigate('Reader', { novel: fullNovel, chapterId: targetChapterNum })
              }}
            >
              <Text style={styles.readButtonText}>
                 {lastReadChapterId > 0 ? 'استئناف القراءة' : 'ابدأ القراءة'}
              </Text>
              <Ionicons name="book-outline" size={20} color="#000" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            {renderTabButton('chapters', 'الفصول')}
            {renderTabButton('about', 'نظرة عامة')}
          </View>

          {error && (
            <View style={{backgroundColor: 'rgba(255, 68, 68, 0.1)', padding: 10, borderRadius: 8, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center'}}>
                <Ionicons name="alert-circle" size={20} color="#ff4444" style={{marginLeft: 8}} />
                <Text style={{color: '#ff4444', textAlign: 'right', flex: 1}}>
                    تعذر تحديث البيانات.
                </Text>
                <TouchableOpacity onPress={fetchDetails}>
                    <Text style={{color: '#fff', textDecorationLine: 'underline'}}>إعادة</Text>
                </TouchableOpacity>
            </View>
          )}

          {activeTab === 'about' ? (
            <View style={styles.aboutSection}>
              <Text style={styles.sectionTitle}>القصة</Text>
              <Text style={styles.descriptionText}>
                  {fullNovel.description || 'لا يوجد وصف متاح.'}
              </Text>
              
              <Text style={styles.sectionTitle}>التصنيفات</Text>
              <View style={styles.tagsRow}>
                {uniqueTags.map((tag, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.tag}
                    onPress={() => navigation.navigate('Category', { category: tag })}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Author Widget at the bottom */}
              <AuthorWidget />
            </View>
          ) : (
            <View style={styles.chaptersList}>
               {loading && chapters.length === 0 ? (
                   <ActivityIndicator color="#4a7cc7" style={{marginTop: 20}} />
               ) : chapters.length > 0 ? (
                   chapters.map(item => (
                     <View key={item._id || item.number}>
                        {renderChapterItem({ item })}
                     </View>
                   ))
               ) : (
                   <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>لا توجد فصول بعد.</Text>
               )}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 90, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  headerSafe: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  floatingControls: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, pointerEvents: 'box-none' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  coverContainer: { height: height * 0.55, width: '100%' },
  coverImage: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  contentContainer: { marginTop: -40, paddingHorizontal: 20 },
  
  statusBadgeContainer: { alignItems: 'center', marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 25 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, backgroundColor: '#111', paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: '#222' },
  statItem: { alignItems: 'center', paddingHorizontal: 20 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: '#333' },
  
  actionRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  readButton: { flex: 1, height: 56, backgroundColor: '#fff', borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  readButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  libraryButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  libraryButtonActive: { backgroundColor: '#4a7cc7', borderColor: '#4a7cc7' },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A1A1A', marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { fontSize: 16, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  aboutSection: { paddingBottom: 40 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'right', marginTop: 10 },
  descriptionText: { color: '#ccc', fontSize: 16, lineHeight: 26, textAlign: 'right', marginBottom: 25 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  tag: { backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  tagText: { color: '#ccc', fontSize: 14 },
  chaptersList: { paddingBottom: 20 },
  chapterRowContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  chapterItem: { flex: 1, flexDirection: 'row-reverse', paddingVertical: 16, alignItems: 'center' },
  chapterItemRead: { backgroundColor: 'rgba(255,255,255,0.03)' },
  chapterContent: { flex: 1, marginLeft: 15 },
  chapterTitle: { color: '#fff', fontSize: 16, textAlign: 'right', marginBottom: 4 },
  textRead: { color: '#888' },
  chapterDate: { color: '#444', fontSize: 12, textAlign: 'right' },
  chapterLeft: { paddingLeft: 10 },
  adminControls: { flexDirection: 'column', gap: 5, paddingRight: 10, justifyContent: 'center' },
  adminBtn: { padding: 8, backgroundColor: '#1a1a1a', borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  
  // FINAL RE-ADAPTED AUTHOR WIDGET STYLES
  authorSection: { marginTop: 30, borderTopWidth: 1, borderColor: '#222', paddingTop: 20 },
  authorCardContainer: { 
      borderRadius: 16, 
      overflow: 'hidden', 
      marginTop: 10,
      borderWidth: 1,
      borderColor: '#222'
  },
  authorBannerWrapper: {
      width: '100%',
      height: 140, // Nice rectangular banner height
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      backgroundColor: '#000'
  },
  authorBannerImage: {
      position: 'absolute',
      width: '100%',
      height: '100%'
  },
  authorOverlayContent: {
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      width: '100%'
  },
  authorAvatarWrapper: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 3,
      borderColor: '#fff', // White border to separate from background
      backgroundColor: '#333',
      marginBottom: 8,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 5
  },
  authorAvatarImage: {
      width: '100%',
      height: '100%'
  },
  authorDisplayName: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textShadowColor: 'rgba(0, 0, 0, 0.9)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 6
  }
});