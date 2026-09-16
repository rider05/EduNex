/**
 * ==============================================================================
 * 🏠 RESIDENCE & TRANSPORT RESOLVER UTILITY FOR EDUNEX STUDENTS
 * ==============================================================================
 * Determines whether a student is a residential Hosteler (requiring Hostel Gate
 * Pass and Mess Menu) or a Day Scholar Commuter (requiring Campus Bus Tracker).
 * ==============================================================================
 */

export function getStudentResidenceType(student = {}, user = {}) {
  const merged = { ...(user || {}), ...(student || {}) };

  const hostelVal = merged.hostel !== undefined ? merged.hostel : user?.hostel;
  const resStatus = String(
    merged.residentialStatus ||
    user?.residentialStatus ||
    merged.residential ||
    user?.residential ||
    ""
  ).trim().toLowerCase();

  const room = String(
    merged.roomNo ||
    merged.roomNumber ||
    merged.room ||
    merged.hostelDetails?.roomNo ||
    user?.roomNo ||
    ""
  ).trim();

  const hostelName = String(
    merged.hostelName ||
    merged.hostelDetails?.name ||
    user?.hostelName ||
    ""
  ).trim();

  const hscMarks = String(merged.hscMarks || user?.hscMarks || "").trim().toLowerCase();

  // Hosteler detection
  const isHosteler =
    hostelVal === true ||
    hostelVal === "true" ||
    hostelVal === 1 ||
    String(hostelVal).toLowerCase() === "hosteler" ||
    String(hostelVal).toLowerCase() === "residential" ||
    resStatus.includes("hostel") ||
    resStatus.includes("resident") ||
    hscMarks === "hosteler" ||
    (Boolean(room) && !resStatus.includes("day scholar")) ||
    (Boolean(hostelName) && !resStatus.includes("day scholar"));

  // Transport detection
  const transportVal =
    merged.transport !== undefined
      ? merged.transport
      : user?.transport !== undefined
      ? user.transport
      : merged.hasTransport;

  const busRoute = String(
    merged.busRoute ||
    merged.route ||
    merged.busNo ||
    user?.busRoute ||
    user?.busNo ||
    ""
  ).trim();

  const busStop = String(merged.busStop || user?.busStop || "").trim();

  const hasExplicitTransport =
    transportVal === true ||
    transportVal === "true" ||
    transportVal === 1 ||
    String(transportVal).toLowerCase() === "yes" ||
    String(transportVal).toLowerCase() === "opted" ||
    String(transportVal).toLowerCase().includes("bus") ||
    Boolean(busRoute) ||
    Boolean(busStop) ||
    Boolean(merged.transportDetails || user?.transportDetails);

  // If hosteler, transport is false unless explicitly opted with a route.
  // If not a hosteler (Day Scholar), transport is true unless explicitly set to false.
  const isTransport =
    hasExplicitTransport ||
    (!isHosteler && transportVal !== false && transportVal !== "false" && transportVal !== 0);

  return {
    isHosteler,
    isTransport,
    residenceLabel: isHosteler ? "Hosteler" : "Day Scholar",
    residenceDetail: isHosteler
      ? room
        ? `Room ${room}`
        : hostelName || "Hostel Residency"
      : busRoute
      ? busRoute.length > 25
        ? busRoute.slice(0, 25) + "..."
        : busRoute
      : "Campus Bus Line",
  };
}

export default getStudentResidenceType;
