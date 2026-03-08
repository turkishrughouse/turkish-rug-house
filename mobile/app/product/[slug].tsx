
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ShoppingBag, ArrowLeft, Heart } from "lucide-react-native";
import { useCart } from "@/context/CartContext";

const filteredSlug = (slug: string | string[]) => Array.isArray(slug) ? slug[0] : slug;

const getApiUrl = () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
    const { slug } = useLocalSearchParams();
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        fetch(`${getApiUrl()}/api/v1/public/products/${filteredSlug(slug)}`)
            .then(res => res.json())
            .then(data => {
                setProduct(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [slug]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    if (!product || product.error) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <Text>Product not found</Text>
            </View>
        );
    }


    // Parse images
    let images: string[] = [];
    try {
        images = JSON.parse(product.images);
    } catch (e) { }

    const mainImage = images.length > 0 ? (images[0].startsWith("http") ? images[0] : `https://rughouse-demo.vercel.app${images[0]}`) : "https://via.placeholder.com/400";

    const { addToCart } = useCart();

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: "", headerTransparent: true, headerTintColor: "black" }} />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Image Gallery Placeholder (Single Main Image for Phase 1) */}
                <View className="w-full relative bg-gray-100">
                    <Image
                        source={{ uri: mainImage }}
                        style={{ width: width, height: 450 }}
                        resizeMode="cover"
                    />
                    <View className="absolute top-4 right-4 bg-white/80 p-2 rounded-full">
                        <Heart size={24} color="black" />
                    </View>
                </View>

                {/* Content */}
                <View className="p-5">
                    {/* Header Info */}
                    <Text className="text-2xl font-bold text-gray-900 mb-2">{product.title}</Text>
                    <Text className="text-xl font-medium text-gray-600 mb-4">${product.price.toFixed(2)}</Text>

                    {/* Meta Info Example */}
                    <View className="flex-row flex-wrap mb-6 gap-2">
                        {product.types?.map((t: any) => (
                            <View key={t.id} className="bg-gray-100 px-3 py-1 rounded-full">
                                <Text className="text-xs text-gray-600">{t.name}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Description */}
                    <Text className="text-lg font-bold text-gray-900 mb-2">About this rug</Text>
                    <Text className="text-base text-gray-600 leading-6 mb-6">
                        {product.description || "No description available."}
                    </Text>

                    {/* Technical Specs Placeholder */}
                    <View className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                        <Text className="font-bold mb-2">Technical Details</Text>
                        <Text className="text-sm text-gray-500">Stock Code: {product.slug}</Text>
                        <Text className="text-sm text-gray-500">Material: 100% Wool (Example)</Text>
                        <Text className="text-sm text-gray-500">Origin: Anatolia</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Actions Footer */}
            <SafeAreaView className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-4">
                <TouchableOpacity
                    className="w-full bg-black py-4 rounded-full flex-row justify-center items-center shadow-lg"
                    onPress={() => {
                        addToCart({
                            id: product.id,
                            title: product.title,
                            price: product.price,
                            slug: product.slug,
                            image: mainImage
                        });
                        alert("Added to cart!");
                    }}
                >
                    <ShoppingBag color="white" size={20} style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold text-lg">Add to Cart</Text>
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}
