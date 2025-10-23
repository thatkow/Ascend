const LOCATIONS = [
  { key: 'new-wall', name: 'New Wall', image: './location/New Wall.jpg', hidden: false },
  { key: 'old-wall', name: 'Old Wall', image: './location/Old Wall.jpg', hidden: false },
];

const isLocationVisible = (location) => !!location && location.hidden !== true;

const getDefaultLocation = () => LOCATIONS.find(isLocationVisible) || null;

const LOCATION_STORAGE_KEY = 'ascend.selectedWall';
const WALL_QUERY_PARAM = 'wall';

export {
  LOCATIONS,
  isLocationVisible,
  getDefaultLocation,
  LOCATION_STORAGE_KEY,
  WALL_QUERY_PARAM,
};
