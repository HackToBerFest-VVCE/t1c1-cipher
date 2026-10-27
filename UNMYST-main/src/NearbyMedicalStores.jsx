import { useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Search } from "lucide-react";

function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export default function NearbyMedicalStores({ t }) {
  const [manualLocation, setManualLocation] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  function findNearMe() {
    setError("");
    setMapsUrl("");

    if (!navigator.geolocation) {
      setError("Location is not supported by this browser. Search by city or postal code instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMapsUrl(
          `https://www.google.com/maps/search/pharmacies/@${coords.latitude},${coords.longitude},15z`
        );
        setLocating(false);
      },
      (locationError) => {
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Location permission was denied. Search by city or postal code instead."
            : "Could not get your location. Search by city or postal code instead."
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleManualSearch(event) {
    event.preventDefault();
    const location = manualLocation.trim();
    if (!location) return;

    setError("");
    setMapsUrl(mapsSearchUrl(`pharmacies near ${location}`));
  }

  return (
    <section className="workspace-card nearby-stores-card">
      <div className="workspace-heading">
        <div className="workspace-icon"><MapPin size={25} /></div>
        <div>
          <span className="eyebrow">{t("LOCAL SUPPORT")}</span>
          <h2>{t("Nearby Medical Stores")}</h2>
          <p>{t("Find nearby pharmacies using your location or a city/postal code.")}</p>
        </div>
      </div>

      <div className="nearby-location-panel">
        <div className="nearby-location-copy">
          <LocateFixed size={20} />
          <div>
            <h3>{t("Use my current location")}</h3>
            <p>{t("Your browser asks for permission. Your location is only used to open the Maps search.")}</p>
          </div>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={findNearMe}
          disabled={locating}
        >
          <LocateFixed size={17} />
          {locating ? t("Finding location...") : t("Find stores near me")}
        </button>
      </div>

      <div className="nearby-or-divider"><span>{t("OR SEARCH BY AREA")}</span></div>

      <form className="nearby-search-form" onSubmit={handleManualSearch}>
        <label className="visually-hidden" htmlFor="pharmacy-location-search">
          {t("City or postal code")}
        </label>
        <input
          id="pharmacy-location-search"
          className="video-search-input"
          type="search"
          value={manualLocation}
          onChange={(event) => setManualLocation(event.target.value)}
          placeholder={t("Enter city or postal code")}
          maxLength={100}
          required
        />
        <button className="button button-secondary" type="submit">
          <Search size={17} /> {t("Search area")}
        </button>
      </form>

      <p className="nearby-privacy-note">
        {t("Search results open in Google Maps. UNMYST does not save your location or list medicine stock.")}
      </p>

      {error && <p className="inline-error" role="alert">{t(error)}</p>}

      {mapsUrl && (
        <a className="button button-primary nearby-open-map" href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={17} /> {t("Open pharmacy results in Maps")} <ExternalLink size={15} />
        </a>
      )}
    </section>
  );
}
