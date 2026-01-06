
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Animated,
  Modal,
  StatusBar,
  Dimensions,
  Alert,
  ScrollView,
  FlatList,
  TouchableWithoutFeedback,
  Platform // Import Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import api, { incrementView } from '../services/api';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

const FONT_OPTIONS = [
  { id: 'Cairo', name: 'القاهرة', family: "'Cairo', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap' },
  { id: 'Amiri', name: 'أميري', family: "'Amiri', serif", url: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap' },
  { id: 'Geeza', name: 'جيزة', family: "'Geeza Pro', 'Segoe UI', Tahoma, sans-serif", url: '' },
  { id: 'Noto', name: 'نوتو كوفي', family: "'Noto Kufi Arabic', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700&display=swap' },
  { id: 'Arial', name: 'آريال', family: "Arial, sans-serif", url: '' },
  { id: 'Times', name: 'تايمز', family: "'Times New Roman', serif", url: '' },
];

export default function ReaderScreen({ route, navigation }) {
const { novel, chapterId } = route.params;
const [chapter, setChapter] = useState(null);
const [loading, setLoading] = useState(true);
const [realTotalChapters, setRealTotalChapters] = useState(novel.chaptersCount || 0);

// إعدادات القراءة مع قيم افتراضية
const [fontSize, setFontSize] = useState(19);
const [bgColor, setBgColor] = useState('#0a0a0a');
const [textColor, setTextColor] = useState('#e0e0e0');
const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0]);
const [showMenu, setShowMenu] = useState(false);
const [showSettings, setShowSettings] = useState(false);

// Chapter List Drawer State
const [showChapterList, setShowChapterList] = useState(false);
const [isAscending, setIsAscending] = useState(true);
const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
const fadeAnim = useRef(new Animated.Value(0)).current; // For top/bottom bars
const backdropAnim = useRef(new Animated.Value(0)).current; // For drawer backdrop

const insets = useSafeAreaInsets();
const webViewRef = useRef(null);
const flatListRef = useRef(null);

const novelId = novel._id || novel.id || novel.novelId;

// تحميل الإعدادات المحفوظة عند فتح الشاشة
useEffect(() => {
    loadSettings();
}, []);

const loadSettings = async () => {
    try {
        const saved = await AsyncStorage.getItem('@reader_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.fontSize) setFontSize(parsed.fontSize);
            if (parsed.bgColor) {
                setBgColor(parsed.bgColor);
                setTextColor(parsed.bgColor === '#fff' ? '#1a1a1a' : '#e0e0e0');
            }
            if (parsed.fontId) {
                const foundFont = FONT_OPTIONS.find(f => f.id === parsed.fontId);
                if (foundFont) setFontFamily(foundFont);
            }
        }
    } catch (e) { console.error("Error loading settings", e); }
};

const saveSettings = async (newSettings) => {
    try {
        const current = await AsyncStorage.getItem('@reader_settings');
        const existing = current ? JSON.parse(current) : {};
        await AsyncStorage.setItem('@reader_settings', JSON.stringify({ ...existing, ...newSettings }));
    } catch (e) { console.error("Error saving settings", e); }
};

// وظيفة تحديث التقدم في السيرفر
const updateProgressOnServer = async (currentChapter) => {
  if (!currentChapter) return;
  try {
    await api.post('/api/novel/update', {
      novelId: novelId,
      title: novel.title,
      cover: novel.cover,
      author: novel.author || novel.translator,
      lastChapterId: parseInt(chapterId), // إرسال رقم الفصل الحالي كآخر فصل
      lastChapterTitle: currentChapter.title
    });
    console.log("✅ Progress updated on server");
  } catch (error) {
    console.error("❌ Failed to update progress on server:", error);
  }
};

useEffect(() => {
const fetchChapter = async () => {
setLoading(true);
try {
const response = await api.get(`/api/novels/${novelId}/chapters/${chapterId}`);
setChapter(response.data);

// تحديث عدد الفصول الكلي من استجابة السيرفر
if (response.data.totalChapters) {
    setRealTotalChapters(response.data.totalChapters);
}

// تصحيح: إرسال رقم الفصل لاحتساب المشاهدة بشكل صحيح
incrementView(novelId, chapterId);
// استدعاء تحديث التقدم فور تحميل الفصل
updateProgressOnServer(response.data);
} catch (error) {
console.error("Error fetching chapter:", error);
Alert.alert("خطأ", "فشل تحميل الفصل");
} finally {
setLoading(false);
}
};
fetchChapter();
}, [chapterId]);

// --- Menu Logic ---
const toggleMenu = useCallback(() => {
  if (showChapterList) {
      closeChapterList();
      return;
  }
  
  // Use current value to determine next state
  // We need to use set function to access latest state if inside callback without dependencies
  setShowMenu(prevShowMenu => {
      const nextShowMenu = !prevShowMenu;
      Animated.timing(fadeAnim, {
        toValue: nextShowMenu ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      return nextShowMenu;
  });
}, [showChapterList]);

// WEB: Listen for messages from iframe to toggle menu
useEffect(() => {
  if (Platform.OS === 'web') {
    const handleMessage = (event) => {
      // Ensure we trust the source or just check data content
      if (event.data === 'toggleMenu') {
        toggleMenu();
      }
    };
    
    // Add listener
    window.addEventListener('message', handleMessage);
    
    // Cleanup
    return () => window.removeEventListener('message', handleMessage);
  }
}, [toggleMenu]);

// --- Chapter List Drawer Logic ---
const openChapterList = () => {
    setShowChapterList(true);
    Animated.parallel([
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        })
    ]).start();
};

const closeChapterList = () => {
    Animated.parallel([
        Animated.timing(slideAnim, {
            toValue: -DRAWER_WIDTH,
            duration: 300,
            useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        })
    ]).start(() => setShowChapterList(false));
};

const sortedChapters = useMemo(() => {
    if (!novel.chapters) return [];
    let list = [...novel.chapters];
    if (!isAscending) {
        list.reverse();
    }
    return list;
}, [novel.chapters, isAscending]);

const toggleSort = () => {
    setIsAscending(!isAscending);
};

// Android/iOS Message Handler
const onMessage = (event) => {
  if (event.nativeEvent.data === 'toggleMenu') {
    toggleMenu();
  }
};

const navigateChapter = (targetId) => {
    closeChapterList();
    if (parseInt(targetId) === parseInt(chapterId)) return;
    
    // Slight delay to allow drawer to close
    setTimeout(() => {
        navigation.replace('Reader', { novel, chapterId: targetId });
    }, 300);
};

const navigateNextPrev = (offset) => {
    const nextNum = parseInt(chapterId) + offset;
    if (offset < 0 && nextNum < 1) return;
    if (offset > 0 && realTotalChapters > 0 && nextNum > realTotalChapters) {
        Alert.alert("تنبيه", "أنت في آخر فصل متاح.");
        return;
    }
    navigation.replace('Reader', { novel, chapterId: nextNum });
};

const changeFontSize = (delta) => {
const newSize = fontSize + delta;
if (newSize >= 14 && newSize <= 32) {
setFontSize(newSize);
saveSettings({ fontSize: newSize });
}
};

const changeTheme = (newBgColor) => {
setBgColor(newBgColor);
const newTextColor = newBgColor === '#fff' ? '#1a1a1a' : '#e0e0e0';
setTextColor(newTextColor);
saveSettings({ bgColor: newBgColor });
};

const handleFontChange = (font) => {
    setFontFamily(font);
    saveSettings({ fontId: font.id });
};

const generateHTML = () => {
if (!chapter) return '';

const formattedContent = chapter.content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => `<p>${line}</p>`)
    .join('');

const fontImports = FONT_OPTIONS.map(f => f.url ? `@import url('${f.url}');` : '').join('\n');

return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      ${fontImports}
      * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; box-sizing: border-box; }
      body, html { 
        margin: 0; padding: 0; background-color: ${bgColor}; color: ${textColor};
        font-family: ${fontFamily.family}; line-height: 1.8; -webkit-overflow-scrolling: touch; 
      }
      .container { padding: 25px 20px 120px 20px; width: 100%; max-width: 800px; margin: 0 auto; }
      .title { 
        font-size: ${fontSize + 8}px; font-weight: bold; margin-bottom: 40px; 
        color: ${bgColor === '#fff' ? '#000' : '#fff'}; border-bottom: 1px solid rgba(128,128,128,0.3);
        padding-bottom: 15px; font-family: ${fontFamily.family};
      }
      .content-area { font-size: ${fontSize}px; text-align: justify; word-wrap: break-word; }
      p { margin-bottom: 1.5em; }
      body { user-select: none; -webkit-user-select: none; }
    </style>
  </head>
  <body>
    <div class="container" id="clickable-area">
      <div class="title">${chapter.title}</div>
      <div class="content-area">${formattedContent}</div>
    </div>
    <script>
      // Safe event listener for both Web and Mobile
      // Using 'click' covers most cases. 
      // Try/Catch block prevents crashes on Android if JS engine is strict.
      
      document.addEventListener('click', function(e) {
        try {
            // Check if user is selecting text (don't toggle menu if selecting)
            var selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;

            // Send to React Native (Mobile)
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('toggleMenu');
            } 
            // Send to Parent Window (Web / iframe)
            else if (window.parent) {
                window.parent.postMessage('toggleMenu', '*');
            }
        } catch(err) {
            // If anything fails in JS, do nothing (prevent crash)
        }
      });
    </script>
  </body>
  </html>
`;
};

// Render Item for Chapter List
const renderChapterItem = ({ item }) => {
    const isCurrent = parseInt(item.number) === parseInt(chapterId);
    return (
        <TouchableOpacity 
            style={[styles.drawerItem, isCurrent && styles.drawerItemActive]} 
            onPress={() => navigateChapter(item.number)}
        >
            <View style={{flex: 1}}>
                <Text style={[styles.drawerItemTitle, isCurrent && styles.drawerItemTextActive]} numberOfLines={1}>
                    {item.title || `فصل ${item.number}`}
                </Text>
                <Text style={styles.drawerItemSubtitle}>فصل {item.number}</Text>
            </View>
            {isCurrent && <Ionicons name="eye" size={16} color="#4a7cc7" />}
        </TouchableOpacity>
    );
};

if (loading) {
return (
<View style={[styles.loadingContainer, { backgroundColor: bgColor }]}>
<ActivityIndicator size="large" color="#4a7cc7" />
<Text style={[styles.loadingText, { color: textColor }]}>جاري التحميل…</Text>
</View>
);
}

return (
<View style={[styles.container, { backgroundColor: bgColor }]}>
  <StatusBar hidden={!showMenu} barStyle={bgColor === '#fff' ? 'dark-content' : 'light-content'} animated />

  {/* Top Bar */}
  <Animated.View style={[styles.topBar, { opacity: fadeAnim, paddingTop: insets.top + 10, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }] }]} pointerEvents={showMenu ? 'auto' : 'none'}>
    <View style={styles.topBarContent}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="arrow-forward" size={26} color="#fff" /></TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle} numberOfLines={1}>{chapter.title}</Text>
        <Text style={styles.headerSubtitle}>الفصل {chapterId} من {realTotalChapters > 0 ? realTotalChapters : '؟'}</Text>
      </View>
    </View>
  </Animated.View>

  {/* Content Renderer */}
  {Platform.OS === 'web' ? (
      <iframe
          srcDoc={generateHTML()}
          style={{ flex: 1, border: 'none', backgroundColor: bgColor, width: '100%', height: '100%' }}
          // Note: onClick here won't work for content inside iframe, handled by postMessage listener above
      />
  ) : (
      <WebView 
        ref={webViewRef} 
        originWhitelist={['*']} 
        source={{ html: generateHTML() }} 
        style={{ backgroundColor: bgColor, flex: 1, opacity: 0.99 }} // Opacity hack for some Android rendering bugs
        onMessage={onMessage} 
        javaScriptEnabled={true} 
        domStorageEnabled={true} 
        scrollEnabled={true} 
        showsVerticalScrollIndicator={false} 
        bounces={true} 
        overScrollMode="never" 
        decelerationRate="normal" 
        mixedContentMode="compatibility"
        // CRITICAL FIXES FOR ANDROID CRASHES:
        androidLayerType="software" // Disables hardware acceleration for WebView content, fixes text rendering crashes
        renderToHardwareTextureAndroid={false}
        onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
        }}
        onRenderProcessGone={syntheticEvent => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView render process gone: ', nativeEvent);
        }}
      />
  )}

  {/* Bottom Bar */}
  <Animated.View style={[styles.bottomBar, { opacity: fadeAnim, paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]} pointerEvents={showMenu ? 'auto' : 'none'}>
    <View style={styles.bottomBarContent}>
      
      {/* Left Controls: List + Settings */}
      <View style={styles.leftControls}>
          <TouchableOpacity onPress={openChapterList} style={styles.iconButton}>
              <Ionicons name="list" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
      </View>

      {/* Right Controls: Navigation */}
      <View style={styles.navigationGroup}>
        <TouchableOpacity style={[styles.navButton, { opacity: chapterId <= 1 ? 0.4 : 1 }]} disabled={chapterId <= 1} onPress={() => navigateNextPrev(-1)}>
          <Ionicons name="chevron-forward" size={20} color="#fff" /><Text style={styles.navText}>السابق</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navButton, styles.nextButton, { opacity: (realTotalChapters > 0 && chapterId >= realTotalChapters) ? 0.4 : 1 }]} disabled={realTotalChapters > 0 && chapterId >= realTotalChapters} onPress={() => navigateNextPrev(1)}>
          <Text style={[styles.navText, { color: '#000' }]}>التالي</Text><Ionicons name="chevron-back" size={20} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  </Animated.View>

  {/* Chapter List Drawer */}
  {showChapterList && (
      <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={closeChapterList}>
              <Animated.View style={[styles.drawerBackdrop, { opacity: backdropAnim }]} />
          </TouchableWithoutFeedback>
          
          {/* Drawer Content */}
          <Animated.View style={[
              styles.drawerContent, 
              { 
                  paddingTop: insets.top + 20, 
                  paddingBottom: insets.bottom + 20,
                  transform: [{ translateX: slideAnim }] 
              }
          ]}>
              <View style={styles.drawerHeader}>
                  <TouchableOpacity onPress={closeChapterList}>
                      <Ionicons name="close" size={24} color="#888" />
                  </TouchableOpacity>
                  <Text style={styles.drawerTitle}>الفصول ({sortedChapters.length})</Text>
                  <TouchableOpacity onPress={toggleSort} style={styles.sortButton}>
                      <Ionicons name={isAscending ? "arrow-down" : "arrow-up"} size={18} color="#4a7cc7" />
                  </TouchableOpacity>
              </View>

              <FlatList
                  ref={flatListRef}
                  data={sortedChapters}
                  keyExtractor={(item) => item._id || item.number.toString()}
                  renderItem={renderChapterItem}
                  initialNumToRender={20}
                  contentContainerStyle={styles.drawerList}
                  showsVerticalScrollIndicator={true}
                  indicatorStyle="white"
              />
          </Animated.View>
      </View>
  )}

  {/* Settings Modal */}
  <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
      <View style={styles.settingsSheet}>
        <View style={styles.settingsHandle} />
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>إعدادات القراءة</Text>
          <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close-circle" size={30} color="#555" /></TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>نوع الخط</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontScroll}>
            {FONT_OPTIONS.map((font) => (
              <TouchableOpacity key={font.id} onPress={() => handleFontChange(font)} style={[styles.fontOptionBtn, fontFamily.id === font.id && styles.fontOptionBtnActive]}>
                <Text style={[styles.fontOptionText, fontFamily.id === font.id && styles.fontOptionTextActive]}>{font.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>حجم الخط</Text>
          <View style={styles.settingRow}>
            <TouchableOpacity onPress={() => changeFontSize(2)} style={styles.fontSizeBtn}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
            <Text style={styles.fontSizeDisplay}>{fontSize}</Text>
            <TouchableOpacity onPress={() => changeFontSize(-2)} style={styles.fontSizeBtn}><Ionicons name="remove" size={24} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>السمة</Text>
          <View style={styles.themeRow}>
            {[ { color: '#fff', name: 'فاتح' }, { color: '#2d2d2d', name: 'داكن' }, { color: '#0a0a0a', name: 'أسود' } ].map(theme => (
              <TouchableOpacity key={theme.color} onPress={() => changeTheme(theme.color)} style={styles.themeContainer}>
                <View style={[styles.themeOption, { backgroundColor: theme.color, borderWidth: bgColor === theme.color ? 3 : 1, borderColor: bgColor === theme.color ? '#4a7cc7' : '#555' }]} />
                <Text style={styles.themeName}>{theme.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  </Modal>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1 },
loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
loadingText: { marginTop: 15, fontSize: 16 },
topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(15,15,15,0.97)', zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
topBarContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12 },
iconButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
headerInfo: { flex: 1, alignItems: 'flex-end', marginRight: 15 },
headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
headerSubtitle: { color: '#999', fontSize: 13 },
bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,15,15,0.97)', zIndex: 10 },
bottomBarContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15 },
leftControls: { flexDirection: 'row', gap: 12 },
navigationGroup: { flexDirection: 'row', gap: 12 },
navButton: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#333', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
nextButton: { backgroundColor: '#fff' },
navText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
settingsSheet: { 
    backgroundColor: '#1a1a1a', 
    borderTopLeftRadius: 25, 
    borderTopRightRadius: 25, 
    paddingHorizontal: 20, 
    paddingBottom: 40,
    alignSelf: 'stretch' 
},
settingsHandle: { 
    width: 40, height: 5, backgroundColor: '#444', 
    borderRadius: 3, alignSelf: 'center', marginVertical: 12 
},
settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
settingsTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
settingSection: { marginBottom: 20 },
settingLabel: { color: '#888', fontSize: 13, marginBottom: 12, textAlign: 'right' },
settingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30 },
fontSizeBtn: { backgroundColor: '#333', width: 45, height: 45, borderRadius: 22.5, alignItems: 'center', justifyContent: 'center' },
fontSizeDisplay: { color: '#fff', fontSize: 22, fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
fontScroll: { flexDirection: 'row-reverse', paddingVertical: 5 },
fontOptionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#262626', marginLeft: 10, borderWidth: 1, borderColor: '#333' },
fontOptionBtnActive: { backgroundColor: '#4a7cc7', borderColor: '#4a7cc7' },
fontOptionText: { color: '#aaa', fontSize: 14 },
fontOptionTextActive: { color: '#fff', fontWeight: 'bold' },
themeRow: { flexDirection: 'row', justifyContent: 'space-around' },
themeContainer: { alignItems: 'center', gap: 8 },
themeOption: { width: 50, height: 50, borderRadius: 25 },
themeName: { color: '#888', fontSize: 12 },

// Drawer Styles
drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
drawerContent: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#161616',
    borderRightWidth: 1,
    borderRightColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
},
drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    marginBottom: 5,
},
drawerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
sortButton: { padding: 5, backgroundColor: 'rgba(74, 124, 199, 0.1)', borderRadius: 8 },
drawerList: { paddingHorizontal: 10 },
drawerItem: {
    flexDirection: 'row-reverse', // RTL
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
},
drawerItemActive: {
    backgroundColor: 'rgba(74, 124, 199, 0.15)',
    borderRadius: 8,
    borderBottomColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 199, 0.3)'
},
drawerItemTitle: { color: '#ccc', fontSize: 14, textAlign: 'right', marginBottom: 2 },
drawerItemTextActive: { color: '#4a7cc7', fontWeight: 'bold' },
drawerItemSubtitle: { color: '#666', fontSize: 11, textAlign: 'right' }
});
