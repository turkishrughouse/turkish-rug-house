
import { View, Text, TouchableOpacity } from "react-native";
import { Link } from "expo-router";

interface CategoryCardProps {
    title: string;
    slug: string;
}

export default function CategoryCard({ title, slug }: CategoryCardProps) {
    return (
        <Link href={`/category/${slug}`} asChild>
            <TouchableOpacity className="mr-4 items-center">
                <View className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 items-center justify-center mb-2 shadow-sm">
                    <Text className="text-xl font-bold text-gray-400">
                        {title.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text className="text-xs font-medium text-primary text-center">
                    {title}
                </Text>
            </TouchableOpacity>
        </Link>
    );
}
