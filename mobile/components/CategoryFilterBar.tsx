
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface Category {
    id: string;
    title: string;
    slug: string;
}

interface CategoryFilterBarProps {
    categories: Category[];
    selectedSlug: string | null;
    onSelect: (slug: string | null) => void;
}

export default function CategoryFilterBar({ categories, selectedSlug, onSelect }: CategoryFilterBarProps) {
    return (
        <View className="bg-white border-b border-gray-100 mb-2">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
            >
                <TouchableOpacity
                    onPress={() => onSelect(null)}
                    className={`px-4 py-2 rounded-full border ${!selectedSlug ? "bg-primary border-primary" : "bg-white border-gray-200"}`}
                >
                    <Text className={`text-sm font-medium ${!selectedSlug ? "text-white" : "text-gray-600"}`}>All</Text>
                </TouchableOpacity>

                {categories.map((cat) => (
                    <TouchableOpacity
                        key={cat.id}
                        onPress={() => onSelect(cat.slug)}
                        className={`px-4 py-2 rounded-full border ${selectedSlug === cat.slug ? "bg-primary border-primary" : "bg-white border-gray-200"}`}
                    >
                        <Text className={`text-sm font-medium ${selectedSlug === cat.slug ? "text-white" : "text-gray-600"}`}>{cat.title}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
