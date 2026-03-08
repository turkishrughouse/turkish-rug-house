
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

interface PaginationControlsProps {
    page: number;
    totalPages: number;
    onNext: () => void;
    onPrev: () => void;
    loading?: boolean;
}

export default function PaginationControls({ page, totalPages, onNext, onPrev, loading }: PaginationControlsProps) {
    return (
        <View className="flex-row items-center justify-between px-6 py-6 border-t border-gray-100 bg-white">
            <TouchableOpacity
                onPress={onPrev}
                disabled={page <= 1 || loading}
                className={`flex-row items-center px-4 py-2 rounded-lg border ${page <= 1 ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}
            >
                <ChevronLeft size={20} color={page <= 1 ? "#ccc" : "#1a1a1a"} />
                <Text className={`ml-1 font-medium ${page <= 1 ? "text-gray-300" : "text-primary"}`}>Prev</Text>
            </TouchableOpacity>

            <View className="flex-row items-center">
                {loading ? (
                    <ActivityIndicator size="small" color="#c0a080" />
                ) : (
                    <Text className="text-sm font-medium text-gray-500">
                        Page <Text className="text-primary font-bold">{page}</Text> / {totalPages > 0 ? totalPages : 1}
                    </Text>
                )}
            </View>

            <TouchableOpacity
                onPress={onNext}
                disabled={page >= totalPages || loading}
                className={`flex-row items-center px-4 py-2 rounded-lg border ${page >= totalPages ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}
            >
                <Text className={`mr-1 font-medium ${page >= totalPages ? "text-gray-300" : "text-primary"}`}>Next</Text>
                <ChevronRight size={20} color={page >= totalPages ? "#ccc" : "#1a1a1a"} />
            </TouchableOpacity>
        </View>
    );
}
