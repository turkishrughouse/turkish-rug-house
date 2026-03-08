
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { View, Text, ActivityIndicator, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ChevronRight } from "lucide-react-native";

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function CustomDrawerContent(props: any) {
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    useEffect(() => {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
        fetch(`${apiUrl}/api/v1/public/categories`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setCategories(data);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedIds.includes(id)) {
            setExpandedIds(expandedIds.filter(eid => eid !== id));
        } else {
            setExpandedIds([...expandedIds, id]);
        }
    };

    const navigateToCategory = (slug: string) => {
        router.push(`/category/${slug}`);
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView edges={['top']} className="bg-white">
                <View className="p-6 border-b border-gray-100">
                    <Text className="text-2xl font-bold tracking-tight text-primary">RUGHOUSE</Text>
                    <Text className="text-xs text-gray-500 mt-1">Timeless Rugs</Text>
                </View>
            </SafeAreaView>

            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                <DrawerItem
                    label="Home"
                    labelStyle={{ color: "#1a1a1a", fontWeight: "600", fontSize: 16 }}
                    onPress={() => router.push("/(tabs)")}
                />

                <View className="px-4 py-2 mt-4 mb-2">
                    <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider">Categories</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="small" color="#c0a080" />
                ) : (
                    categories.map((cat) => {
                        const hasChildren = cat.children && cat.children.length > 0;
                        const isExpanded = expandedIds.includes(cat.id);

                        return (
                            <View key={cat.id}>
                                <TouchableOpacity
                                    className="flex-row items-center justify-between py-3 px-4"
                                    onPress={() => hasChildren ? toggleExpand(cat.id) : navigateToCategory(cat.slug)}
                                >
                                    <Text className="text-[15px] font-medium text-[#333]">{cat.title}</Text>
                                    {hasChildren && (
                                        isExpanded ?
                                            <ChevronDown size={16} color="#999" /> :
                                            <ChevronRight size={16} color="#999" />
                                    )}
                                </TouchableOpacity>

                                {hasChildren && isExpanded && (
                                    <View className="bg-gray-50 border-l-2 border-gray-100 ml-4 mb-2">
                                        {cat.children.map((child: any) => (
                                            <TouchableOpacity
                                                key={child.id}
                                                style={{ paddingVertical: 10, paddingHorizontal: 12 }}
                                                onPress={() => navigateToCategory(child.slug)}
                                            >
                                                <Text className="text-gray-600 text-sm">{child.title}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </DrawerContentScrollView>

            <View className="p-4 border-t border-gray-100">
                <Text className="text-xs text-center text-gray-400">© 2026 RugHouse</Text>
            </View>
        </View>
    );
}
