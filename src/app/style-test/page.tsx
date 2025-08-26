"use client";

import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { TailwindButton, TailwindCard } from "~/components/ui/migration-bridge";

// MUI imports
import { 
  Button as MuiButton, 
  Card as MuiCard, 
  CardContent as MuiCardContent,
  TextField,
  Typography,
  Box,
  Avatar as MuiAvatar
} from "@mui/material";

export default function StyleTestPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-900">
          Style System Test Page
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shadcn/ui Components */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">
              shadcn/ui + Tailwind Components
            </h2>
            
            {/* Buttons */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Buttons</h3>
              <div className="flex flex-wrap gap-3">
                <Button>Default Button</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Cards</h3>
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>shadcn/ui Card</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    This is a shadcn/ui card with Tailwind CSS styling. 
                    It uses CSS variables for theming and proper semantic HTML.
                  </p>
                  <div className="mt-4 space-y-2">
                    <Input placeholder="shadcn/ui Input" />
                    <Button className="w-full">Card Action</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Separator />
            
            {/* Avatar */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Avatars</h3>
              <div className="flex gap-4">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
              </div>
            </div>
            
            <Separator />
            
            {/* Bridge Components */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Bridge Components</h3>
              <div className="space-y-3">
                <TailwindButton variant="default">Bridge Button</TailwindButton>
                <TailwindCard className="p-4">
                  <p className="text-gray-600">
                    This is a bridge component that helps transition from MUI to shadcn/ui.
                  </p>
                </TailwindCard>
              </div>
            </div>
            
            {/* Pure Tailwind */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Pure Tailwind</h3>
              <div className="bg-white rounded-lg border p-6 shadow-sm">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">TW</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Tailwind CSS</h4>
                    <p className="text-sm text-gray-500">Utility-first CSS</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm">
                    Primary
                  </button>
                  <button className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300 transition-colors text-sm">
                    Secondary  
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* MUI Components */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">
              Material-UI Components (Existing)
            </h2>
            
            {/* MUI Buttons */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">MUI Buttons</h3>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <MuiButton variant="contained">Contained</MuiButton>
                <MuiButton variant="outlined">Outlined</MuiButton>
                <MuiButton variant="text">Text</MuiButton>
                <MuiButton variant="contained" color="error">Error</MuiButton>
              </Box>
            </div>
            
            {/* MUI Cards */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">MUI Cards</h3>
              <MuiCard sx={{ width: '100%' }}>
                <MuiCardContent>
                  <Typography variant="h6" component="h3" gutterBottom>
                    Material-UI Card
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This is a Material-UI card with emotion CSS-in-JS styling.
                    It uses the theme system and MUI component library.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      variant="outlined"
                      placeholder="MUI TextField"
                      size="small"
                      fullWidth
                    />
                    <MuiButton variant="contained" fullWidth>
                      MUI Card Action
                    </MuiButton>
                  </Box>
                </MuiCardContent>
              </MuiCard>
            </div>
            
            {/* MUI Avatar */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">MUI Avatars</h3>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <MuiAvatar src="https://github.com/mui.png" alt="MUI">M</MuiAvatar>
                <MuiAvatar>UI</MuiAvatar>
              </Box>
            </div>
            
            {/* MUI Layout Examples */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">MUI Layout</h3>
              <Box
                sx={{
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 3,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Material-UI Box
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This demonstrates MUI's sx prop system and theme integration.
                  The styling is handled by emotion and follows Material Design principles.
                </Typography>
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <MuiButton size="small" variant="outlined">
                    Action 1
                  </MuiButton>
                  <MuiButton size="small" variant="outlined">
                    Action 2
                  </MuiButton>
                </Box>
              </Box>
            </div>
          </div>
        </div>
        
        {/* Compatibility Test */}
        <div className="mt-12 p-8 bg-white rounded-lg border">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
            Compatibility Test
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border-2 border-dashed border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-3">Tailwind in MUI Container</h4>
              <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <Button size="sm" className="mb-2">Tailwind Button in MUI Box</Button>
                  <p className="text-sm text-gray-600">
                    This Tailwind content is nested inside a MUI Box component.
                  </p>
                </div>
              </Box>
            </div>
            
            <div className="p-4 border-2 border-dashed border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-3">MUI in Tailwind Container</h4>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="bg-white p-4 rounded shadow-sm">
                  <MuiButton size="small" variant="contained" sx={{ mb: 1, display: 'block' }}>
                    MUI Button in Tailwind
                  </MuiButton>
                  <Typography variant="body2" color="text.secondary">
                    This MUI content is nested inside Tailwind utility classes.
                  </Typography>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-800 font-medium">
                ✅ Both styling systems coexist successfully!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}