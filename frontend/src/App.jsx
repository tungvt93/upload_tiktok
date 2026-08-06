import React from 'react';
import useProfiles from './hooks/useProfiles';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ProfilesView from './components/ProfilesView';
import DistributionView from './components/DistributionView';
import GroupsView from './components/GroupsView';
import SettingsView from './components/SettingsView';
import FolderSelectOverlay from './components/FolderSelectOverlay';

// Top-level layout: sidebar + active tab view. All state & data logic lives in
// the useProfiles hook; this component only composes presentational views.
const App = () => {
  const ui = useProfiles();
  const { activeTab, message } = ui;

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={ui.setActiveTab}
          profilesCount={ui.profiles.length}
          maxConcurrency={ui.config.maxConcurrency}
        />

        <main>
          <Toast message={message} />

          {activeTab === 'profiles' ? (
            <ProfilesView {...ui} />
          ) : activeTab === 'distribution' ? (
            <DistributionView
              distributionProfiles={ui.distributionProfiles}
              handleRemoveDistProfile={ui.handleRemoveDistProfile}
              showAddDistProfileModal={ui.showAddDistProfileModal}
              setShowAddDistProfileModal={ui.setShowAddDistProfileModal}
              groups={ui.groups}
              distGroupFilter={ui.distGroupFilter}
              setDistGroupFilter={ui.setDistGroupFilter}
              filteredDistAvailable={ui.filteredDistAvailable}
              selectedProfileIds={ui.selectedProfileIds}
              setSelectedProfileIds={ui.setSelectedProfileIds}
              handleAddDistProfiles={ui.handleAddDistProfiles}
              showDistributeModal={ui.showDistributeModal}
              setShowDistributeModal={ui.setShowDistributeModal}
              setSourceFolder={ui.setSourceFolder}
              setVideosPerProfile={ui.setVideosPerProfile}
              setDistributeResult={ui.setDistributeResult}
              sourceFolder={ui.sourceFolder}
              videosPerProfile={ui.videosPerProfile}
              isDistributing={ui.isDistributing}
              distributeResult={ui.distributeResult}
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
    </div>
  );
};

export default App;
