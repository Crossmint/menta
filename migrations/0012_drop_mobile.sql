-- The native app is gone: drop its push devices and sign-in hand-off codes.
DROP TABLE IF EXISTS native_push_deliveries;
DROP TABLE IF EXISTS native_push_devices;
DROP TABLE IF EXISTS auth_handoffs
