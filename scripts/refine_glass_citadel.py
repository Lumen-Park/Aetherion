"""Create the pearl-and-optical-glass finish from the existing Blender GLB."""
import json
import struct
from pathlib import Path


def build():
    public = Path(__file__).resolve().parents[1] / "dashboard" / "public"
    source = (public / "glass-citadel.glb").read_bytes()
    length = struct.unpack_from("<I", source, 12)[0]
    document = json.loads(source[20:20 + length])
    metal, glass = document["materials"]
    metal["name"] = "Pearl titanium"
    metal["pbrMetallicRoughness"].update(baseColorFactor=[0.52, 0.59, 0.72, 1], metallicFactor=0.94, roughnessFactor=0.23)
    glass["name"] = "Frosted optical glass"
    glass["pbrMetallicRoughness"].update(baseColorFactor=[0.78, 0.85, 0.94, 1], metallicFactor=0, roughnessFactor=0.12)
    glass["extensions"]["KHR_materials_transmission"]["transmissionFactor"] = 0.88
    for light in document["extensions"]["KHR_lights_punctual"]["lights"]:
        light["intensity"] *= 0.3
        light["color"] = [0.82, 0.89, 1]
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    remaining = source[20 + length:]
    output = struct.pack("<4sII", b"glTF", 2, 20 + len(encoded) + len(remaining))
    output += struct.pack("<I4s", len(encoded), b"JSON") + encoded + remaining
    target = public / "glass-citadel-pearl.glb"
    target.write_bytes(output)
    print(f"Created {target.name} ({len(output):,} bytes)")


if __name__ == "__main__":
    build()
