
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView } from "react-native";
import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ArrowLeft } from "lucide-react-native";

export default function CategoryDetailScreen() {
    const { slug } = useLocalSearchParams();
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [categoryTitle, setCategoryTitle] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;

        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

        // Parallel fetch for category info (optional/mocked if slug is enough) and products
        // For now we fetch products filtered by category
        // Ideally: Fetch category details by slug to get the proper Title, then products

        // Simulating robust fetch:
        fetch(`${apiUrl}/api/v1/public/products?category=${slug}`)
            .then(res => res.json())
            .then(data => {
                // Assuming API returns products array
                // We'll capitalize slug for title if API doesn't return meta
                setCategoryTitle(typeof slug === 'string' ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Category");
                if (Array.isArray(data)) {
                    setProducts(data);
                } else if (data.products && Array.isArray(data.products)) {
                    setProducts(data.products);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

    }, [slug]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#c0a080" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
                    <ArrowLeft size={24} color="#1a1a1a" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-primary flex-1 capitalize">
                    {categoryTitle}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {products.length === 0 ? (
                    <View className="flex-1 justify-center items-center py-20">
                        <Text className="text-gray-400 text-base">No products found in this category.</Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap justify-between">
                        {products.map((prod) => {
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
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
