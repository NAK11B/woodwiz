import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import barkIndex from "../../data/bark_index.json";
import woods from "../../data/woods.json";
import { matchBarkPhoto } from "../../utils/barkMatcher";

export default function HomeScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  async function takePhoto() {
    const res = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!res.canceled) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
      setStatus("idle");
      setStatusMessage("");
    }
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!res.canceled) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
      setStatus("idle");
      setStatusMessage("");
    }
  }

  async function submitImage() {
    if (!photoUri) {
      setStatus("error");
      setStatusMessage("No image selected.");
      return;
    }

    try {
      setStatus("processing");
      setStatusMessage("Identifying wood...");

      const matches = await matchBarkPhoto(photoUri, barkIndex as any);

      if (!matches || !matches.length) {
        setStatus("error");
        setStatusMessage("No match found. Try a clearer photo.");
        return;
      }

      const best = matches[0];
      const found = woods.find((w: any) => w.id === best.speciesKey);

      if (!found) {
        setStatus("error");
        setStatusMessage(`Matched ${best.speciesKey}, but not in woods.json`);
        return;
      }

      setResult({
        ...found,
        confidence: Math.round(best.confidence * 100),
      });

      setStatus("done");
      setStatusMessage("");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Something broke. Try again.");
    }
  }

  function clearImage() {
    setPhotoUri(null);
    setResult(null);
    setStatus("idle");
    setStatusMessage("");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>WoodWiz</Text>

      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.preview} />
      )}

      <TouchableOpacity style={styles.button} onPress={takePhoto}>
        <Text style={styles.buttonText}>Take Image of Bark</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>Choose Bark Image</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.submitButton} onPress={submitImage}>
        <Text style={styles.buttonText}>Submit Bark Image</Text>
      </TouchableOpacity>

      {photoUri && (
        <TouchableOpacity onPress={clearImage}>
          <Text style={styles.clear}>Clear image</Text>
        </TouchableOpacity>
      )}

      {status === "processing" && (
        <View style={{ marginTop: 10 }}>
          <ActivityIndicator size="large" />
          <Text>Identifying wood...</Text>
        </View>
      )}

      {status === "error" && (
        <Text style={styles.error}>{statusMessage}</Text>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.match}>
            🌳 Match: {result.common_name} ({result.confidence}%)
          </Text>

          <Text style={styles.title}>{result.common_name}</Text>
          <Text style={styles.scientific}>{result.scientific_name}</Text>

          <Text style={styles.fact}>Hardness: {result.hardness_level}</Text>
          <Text style={styles.fact}>Strength: {result.strength_level}</Text>
          <Text style={styles.fact}>Stability: {result.stability}</Text>
          <Text style={styles.fact}>Rot Resistance: {result.rot_resistance}</Text>
          <Text style={styles.fact}>Indoor/Outdoor: {result.indoor_outdoor}</Text>
          <Text style={styles.fact}>Workability: {result.workability}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#2e7d32",
    padding: 14,
    borderRadius: 999,
    width: "100%",
    marginVertical: 6,
  },
  submitButton: {
    backgroundColor: "#1b5e20",
    padding: 16,
    borderRadius: 999,
    width: "100%",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  clear: {
    color: "#2e7d32",
    marginTop: 8,
  },
  error: {
    color: "red",
    marginTop: 10,
  },
  resultBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    width: "100%",
  },
  match: {
    fontWeight: "bold",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  scientific: {
    fontStyle: "italic",
    marginBottom: 8,
  },
  fact: {
    marginBottom: 4,
  },
});
