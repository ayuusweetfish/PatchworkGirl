import AudioToolbox
import CoreAudio
import Foundation

// TODO: Check on newer macOS versions
let kAudioObjectPropertyElementMain = kAudioObjectPropertyElementMaster
let kAudioHardwareServiceDeviceProperty_VirtualMainVolume = kAudioHardwareServiceDeviceProperty_VirtualMasterVolume
let kAudioHardwareServiceDeviceProperty_VirtualMainBalance = kAudioHardwareServiceDeviceProperty_VirtualMasterBalance

public final class SoundOutputManager {
  /// All the possible errors that could occur while interacting
  /// with the default output device.
  enum Errors: Error {
          /// The system couldn't complete the requested operation and
          /// returned the given status.
    case  operationFailed(OSStatus)
          /// The current default output device doesn't support the requested property.
    case  unsupportedProperty
          /// The current default output device doesn't allow changing the requested property.
    case  immutableProperty
          /// There is no default output device.
    case  noDevice
  }
  
  internal init() { }
  
  /// Get the system default output device.
  ///
  /// You can use this value to interact with the device directly
  /// via other system calls.
  ///
  /// - throws: `Errors.operationFailed` if the system fails to return the default output device.
  /// - returns: the default device ID or `nil` if none is set.
  public func retrieveDefaultOutputDevice() throws -> AudioDeviceID? {
    var result = kAudioObjectUnknown
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDefaultOutputDevice,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    
    // Ensure that a default device exists.
    guard AudioObjectHasProperty(AudioObjectID(kAudioObjectSystemObject), &address) else { return nil }
    
    // Attempt to get the default output device.
    let error = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &result)
    guard error == noErr else {
      throw Errors.operationFailed(error)
    }
    
    if result == kAudioObjectUnknown {
      throw Errors.noDevice
    }
    
    return result
  }

  /// Get the volume of the system default output device.
  ///
  /// - throws: `Errors.noDevice` if the system doesn't have a default output device; `Errors.unsupportedProperty` if the current device doesn't have a volume property; `Errors.operationFailed` if the system is unable to read the property value.
  /// - returns: The current volume in a range between 0 and 1.
  public func readVolume() throws -> Float {
    guard let deviceID = try retrieveDefaultOutputDevice() else {
      throw Errors.noDevice
    }
    
    var size = UInt32(MemoryLayout<Float32>.size)
    var volume: Float = 0
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    
    // Ensure the device has a volume property.
    guard AudioObjectHasProperty(deviceID, &address) else {
      throw Errors.unsupportedProperty
    }
    
    let error = AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, &volume)
    guard error == noErr else {
      throw Errors.operationFailed(error)
    }
    
    return min(max(0, volume), 1)
  }
  
  /// Set the volume of the system default output device.
  ///
  /// - parameter newValue: The volume to set in a range between 0 and 1.
  /// - throws: `Erors.noDevice` if the system doesn't have a default output device; `Errors.unsupportedProperty` or `Errors.immutableProperty` if the output device doesn't support setting or doesn't currently allow changes to its volume; `Errors.operationFailed` if the system is unable to apply the volume change.
  public func setVolume(_ newValue: Float) throws {
    guard let deviceID = try retrieveDefaultOutputDevice() else {
      throw Errors.noDevice
    }
    
    var normalizedValue = min(max(0, newValue), 1)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    
    // Ensure the device has a volume property.
    guard AudioObjectHasProperty(deviceID, &address) else {
      throw Errors.unsupportedProperty
    }
    
    var canChangeVolume = DarwinBoolean(true)
    let size = UInt32(MemoryLayout<Float>.size(ofValue: normalizedValue))
    let isSettableError = AudioObjectIsPropertySettable(deviceID, &address, &canChangeVolume)
    
    // Ensure the volume property is editable.
    guard isSettableError == noErr else {
      throw Errors.operationFailed(isSettableError)
    }
    guard canChangeVolume.boolValue else {
      throw Errors.immutableProperty
    }
    
    let error = AudioObjectSetPropertyData(deviceID, &address, 0, nil, size, &normalizedValue)
    
    if error != noErr {
      throw Errors.operationFailed(error)
    }
  }
  
  /// Get the balance of the system default output device.
  ///
  /// - throws: `Errors.noDevice` if the system doesn't have a default output device; `Errors.unsupportedProperty` if the current device doesn't have a balance property; `Errors.operationFailed` if the system is unable to read the property value.
  /// - returns: The current balance in a range between 0 and 1.
  public func readBalance() throws -> Float {
    guard let deviceID = try retrieveDefaultOutputDevice() else {
      throw Errors.noDevice
    }
    
    var size = UInt32(MemoryLayout<Float32>.size)
    var balance: Float = 0
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainBalance,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    
    // Ensure the device has a balance property.
    guard AudioObjectHasProperty(deviceID, &address) else {
      throw Errors.unsupportedProperty
    }
    
    let error = AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, &balance)
    guard error == noErr else {
      throw Errors.operationFailed(error)
    }
    
    return balance
  }

  /// Set the balance of the system default output device.
  ///
  /// - parameter newValue: The balance to set in a range between 0 and 1.
  /// - throws: `Erors.noDevice` if the system doesn't have a default output device; `Errors.unsupportedProperty` or `Errors.immutableProperty` if the output device doesn't support setting or doesn't currently allow changes to its balance; `Errors.operationFailed` if the system is unable to apply the balance change.
  public func setBalance(_ newValue: Float) throws {
    guard let deviceID = try retrieveDefaultOutputDevice() else {
      throw Errors.noDevice
    }
    
    var normalizedValue = min(max(0, newValue), 1)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainBalance,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    
    // Ensure the device has a balance property.
    guard AudioObjectHasProperty(deviceID, &address) else {
      throw Errors.unsupportedProperty
    }
    
    var canChangeBalance = DarwinBoolean(true)
    let size = UInt32(MemoryLayout<Float>.size(ofValue: normalizedValue))
    let isSettableError = AudioObjectIsPropertySettable(deviceID, &address, &canChangeBalance)
    
    // Ensure the balance property is editable.
    guard isSettableError == noErr else {
      throw Errors.operationFailed(isSettableError)
    }
    guard canChangeBalance.boolValue else {
      throw Errors.immutableProperty
    }
    
    let error = AudioObjectSetPropertyData(deviceID, &address, 0, nil, size, &normalizedValue)
    
    if error != noErr {
      throw Errors.operationFailed(error)
    }
  }
}
