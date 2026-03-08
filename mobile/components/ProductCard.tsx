
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Link } from "expo-router";

interface ProductCardProps {
    id: string;
    title: string;
    price: number | string;
    image?: string | null;
    slug: string;
}

export default function ProductCard({ id, title, price, image, slug }: ProductCardProps) {
    // Format price if it's a number
    const formattedPrice = typeof price === 'number'
        ? `$${price.toFixed(2)}`
        : price;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
    const imageUrl = image?.startsWith("/") ? `${apiUrl}${image}` : image;

    return (
        <Link href={`/product/${slug}`} asChild>
            <TouchableOpacity className="w-[48%] mb-6 bg-white rounded-lg shadow-sm active:opacity-90 overflow-hidden">
                <View className="aspect-[4/5] bg-gray-100 w-full relative">
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <Text className="text-gray-300 text-xs">No Image</Text>
                        </View>
                    )}
                </View>

                <View className="p-3">
                    <Text
                        numberOfLines={1}
                        className="text-sm font-medium text-primary mb-1"
                    >
                        {title}
                    </Text>
                    <Text className="text-sm font-semibold text-accent">
                        {formattedPrice}
                    </Text>
                </View>
            </TouchableOpacity>
        </Link>
    );
}
