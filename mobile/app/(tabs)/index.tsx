
import { Text, View, ScrollView, ActivityIndicator, SafeAreaView, RefreshControl, Image } from "react-native";
import { useEffect, useState, useCallback } from "react";
import ProductCard from "@/components/ProductCard";
import CategoryCard from "@/components/CategoryCard";

const getApiUrl = () => {
    return process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
};

export default function HomeScreen() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const response = await fetch(`${getApiUrl()}/api/v1/public/home`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {/* Hero Section */}
                <View className="w-full h-64 bg-primary justify-center items-center mb-8 shadow-sm">
                    <Image
                        source={{ uri: "https://images.unsplash.com/photo-1596230529625-7ee541adabd3?q=80&w=1000&auto=format&fit=crop" }}
                        className="absolute w-full h-full opacity-60"
                        resizeMode="cover"
                    />
                    <View className="px-6 items-center">
                        <Text className="text-white text-4xl font-serif italic text-center mb-2 tracking-wider">
                            RUGHOUSE
                        </Text>
                        <Text className="text-gray-200 text-sm font-medium tracking-widest uppercase border-t border-gray-400 pt-2 w-full text-center">
                            Timeless Rugs
                        </Text>
                    </View>
                </View>

                {/* Categories Horizontal Scroll */}
                <View className="mb-8 pl-5">
                    <View className="mb-4 pr-5 flex-row justify-between items-end">
                        <Text className="text-xl font-bold text-primary tracking-tight">Collections</Text>
                        <Text className="text-xs font-semibold text-accent uppercase tracking-wider">Explore</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                        {data?.categories?.map((cat: any) => (
                            <CategoryCard key={cat.id} title={cat.title} slug={cat.slug} />
                        ))}
                    </ScrollView>
                </View>

                {/* Featured Products Grid */}
                <View className="px-5">
                    <View className="mb-5 flex-row items-center justify-between">
                        <View>
                            <Text className="text-xl font-bold text-primary tracking-tight">New Arrivals</Text>
                            <Text className="text-xs text-gray-500 mt-0.5">Fresh from the loom</Text>
                        </View>
                    </View>

                    <View className="flex-row flex-wrap justify-between">
                        {data?.featuredProducts?.map((prod: any) => {
                            // Parse Images JSON if string
                            let image = null;
                            try {
                                const images = typeof prod.images === 'string' ? JSON.parse(prod.images) : prod.images;
                                if (Array.isArray(images) && images.length > 0) image = images[0];
                            } catch (e) { }

                            return (
                                <ProductCard
                                    key={prod.id}
                                    id={prod.id}
                                    title={prod.title}
                                    price={Number(prod.price)}
                                    slug={prod.slug}
                                    image={image}
                                />
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
