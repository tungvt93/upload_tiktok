import DistributionView from './components/DistributionView';
import FolderSelectOverlay from './components/FolderSelectOverlay';
import GroupsView from './components/GroupsView';
import ProfilesView from './components/ProfilesView';
import SettingsView from './components/SettingsView';
import Sidebar from './components/Sidebar';
import StatsModal from './components/StatsModal';
import Toast from './components/Toast';
import useProfiles from './hooks/useProfiles';
import useTheme from './hooks/useTheme';

// Top-level layout: sidebar + active tab view. All state & data logic lives in
// the useProfiles hook; this component only composes presentational views.
const App = () => {
  const ui = useProfiles();
  const { theme, toggleTheme } = useTheme();
  const { activeTab, message } = ui;

  return (
    <div className="app-container">
      <div className="app-layout">
        <Sidebar
          activeTab={activeTab}
          onTabChange={ui.setActiveTab}
          profilesCount={ui.profiles?.length || 0}
          maxConcurrency={ui.config?.maxConcurrency || 2}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="content-area">
          <Toast message={message} />

          {activeTab === 'profiles' ? (
            <ProfilesView {...ui} />
          ) : activeTab === 'distribution' ? (
            <DistributionView
              groups={ui.groups}
              distGroupId={ui.distGroupId}
              setDistGroupId={ui.setDistGroupId}
              distGroupProfiles={ui.distGroupProfiles}
              sourceFolder={ui.sourceFolder}
              setSourceFolder={ui.setSourceFolder}
              videosPerProfile={ui.videosPerProfile}
              setVideosPerProfile={ui.setVideosPerProfile}
              isDistributing={ui.isDistributing}
              distributeResult={ui.distributeResult}
              setDistributeResult={ui.setDistributeResult}
              handleSelectDistSourceFolder={ui.handleSelectDistSourceFolder}
              handleDistribute={ui.handleDistribute}
            />
          ) : activeTab === 'groups' ? (
            <GroupsView
              groups={ui.groups}
              newGroupName={ui.newGroupName}
              setNewGroupName={ui.setNewGroupName}
              addGroup={ui.addGroup}
              editingGroupId={ui.editingGroupId}
              setEditingGroupId={ui.setEditingGroupId}
              editingGroupValue={ui.editingGroupValue}
              setEditingGroupValue={ui.setEditingGroupValue}
              updateGroupName={ui.updateGroupName}
              deleteGroup={ui.deleteGroup}
            />
          ) : (
            <SettingsView
              config={ui.config}
              setConfig={ui.setConfig}
              updateConfig={ui.updateConfig}
            />
          )}
        </main>
      </div>

      {/* Folder Selection Loading Overlay */}
      <FolderSelectOverlay visible={ui.isSelectingFolder} />
      <StatsModal
        isOpen={ui.isStatsModalOpen}
        profileIds={ui.statsProfileIds}
        onClose={ui.closeStatsModal}
      />
    </div>
  );
};

export default App;
