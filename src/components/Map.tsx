import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center: [number, number];
  driverLocation: [number, number];
}

export default function Map({ center, driverLocation }: MapProps) {
  return (
    <MapContainer center={center} zoom={13} style={{ height: '300px', width: '100%' }} className="rounded-2xl">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={center}>
        <Popup>Pickup Point</Popup>
      </Marker>
      <Marker position={driverLocation}>
        <Popup>Driver Location</Popup>
      </Marker>
    </MapContainer>
  );
}
