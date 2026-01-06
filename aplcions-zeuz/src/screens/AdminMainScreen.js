

import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const { width } = Dimensions.get('window');

export default function AdminMainScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const [stats, setStats] = useState({ users: 0, novels: 0, views: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      fetchStats();
  }, []);

  const fetchStats = async () => {
      try {
          // This is a mock/simple fetch. In real app, you'd have a specific dashboard stats endpoint.
          // Reusing existing endpoints to get rough numbers
          const usersRes = await api.get('/api/admin/users');
          const novelsRes = await api.get('/api/novels?limit=1'); 
          
          setStats({
              users: usersRes.data.length,
              novels: novelsRes.data.totalNovels || 0,
              views: '---' // Requires backend aggregation
          });
      } catch (e) {
          console.log(e);
      } finally {
          setLoading(false);
      }
  };

  const DashboardCard = ({ title, icon, color, onPress, subtitle }) => (
      <TouchableOpacity 
        style={styles.cardContainer} 
        onPress={onPress}
        activeOpacity={0.9}
      >
          <LinearGradient
              colors={[color + '20', '#161616']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
          >
              <View style={[styles.iconBox, { backgroundColor: color + '30' }]}>
                  <Ionicons name={icon} size={28} color={color} />
              </View>
              <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
              </View>
              <Ionicons name="chevron-back" size={20} color="#444" />
          </LinearGradient>
      </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(74, 124, 199, 0.15)', '#000000']}
        style={styles.background}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
            <View>
                <Text style={styles.greeting}>مرحباً، {userInfo?.name}</Text>
                <Text style={styles.roleText}>لوحة تحكم المشرف العام</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            
            {/* Quick Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{loading ? '...' : stats.users}</Text>
                    <Text style={styles.statLabel}>المستخدمين</Text>
                </View>
                <View style={[styles.statBox, {borderLeftWidth:1, borderRightWidth:1, borderColor:'#333'}]}>
                    <Text style={styles.statNumber}>{loading ? '...' : stats.novels}</Text>
                    <Text style={styles.statLabel}>الروايات</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>Zeus</Text>
                    <Text style={styles.statLabel}>النظام</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>الوصول السريع</Text>

            <View style={styles.grid}>
                <DashboardCard 
                    title="النشر المتعدد (Bulk)" 
                    subtitle="رفع ملف ZIP يحتوي على الفصول"
                    icon="cloud-upload" 
                    color="#f59e0b" // لون برتقالي مميز
                    onPress={() => navigation.navigate('BulkUpload')}
                />

                <DashboardCard 
                    title="إدارة المستخدمين" 
                    subtitle="الصلاحيات، الحظر، الحذف"
                    icon="people" 
                    color="#a855f7" 
                    onPress={() => navigation.navigate('UsersManagement')}
                />
                
                <DashboardCard 
                    title="إدارة الروايات" 
                    subtitle="تعديل، حذف، إضافة فصول"
                    icon="library" 
                    color="#3b82f6" 
                    onPress={() => navigation.navigate('Management')}
                />

                <DashboardCard 
                    title="إنشاء عمل جديد" 
                    subtitle="إضافة رواية جديدة للنظام"
                    icon="add-circle" 
                    color="#10b981" 
                    onPress={() => navigation.navigate('AdminDashboard')}
                />
            </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  background: { position: 'absolute', left: 0, right: 0, top: 0, height: 400 },
  safeArea: { flex: 1 },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  roleText: { fontSize: 14, color: '#4a7cc7', marginTop: 4, textAlign: 'right', fontWeight: '600' },
  closeBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  
  content: { padding: 20 },
  
  statsRow: {
      flexDirection: 'row',
      backgroundColor: '#161616',
      borderRadius: 16,
      padding: 20,
      marginBottom: 30,
      borderWidth: 1,
      borderColor: '#333'
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { color: '#888', fontSize: 12 },

  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'right' },
  
  grid: { gap: 15 },
  cardContainer: {
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 5,
      borderWidth: 1,
      borderColor: '#2a2a2a'
  },
  cardGradient: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      padding: 20,
  },
  iconBox: {
      width: 50,
      height: 50,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 15
  },
  cardContent: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  cardSubtitle: { color: '#888', fontSize: 12, textAlign: 'right' },
});